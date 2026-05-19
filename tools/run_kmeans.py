"""K-means 토픽 클러스터링 배치.

embed 서버에서 실행 권장 (WAS DB와 같은 네트워크 안).
주 1회 cron 실행 또는 수동 트리거.

실행:
    python3 tools/run_kmeans.py --n-clusters 30 --top-keywords 5
"""
from __future__ import annotations
import argparse
import json
import logging
import os
import re
import sys
from collections import Counter

import numpy as np
import psycopg2
from psycopg2.extras import execute_values
from sklearn.cluster import MiniBatchKMeans
from sklearn.feature_extraction.text import TfidfVectorizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kmeans")


def fetch_all_embeddings(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT list_id, COALESCE(list_title, ''), title_embedding::text "
            "FROM public_api_list WHERE title_embedding IS NOT NULL"
        )
        for list_id, title, emb_str in cur:
            # pgvector text 표현: '[0.1,0.2,...]'
            vec = np.array(json.loads(emb_str), dtype=np.float32)
            yield list_id, title, vec


def extract_topic_keywords(titles_per_cluster: dict[int, list[str]], top_n: int = 5) -> dict[int, str]:
    """각 클러스터의 list_title 모음에서 TF-IDF Top-N 키워드 추출."""
    out = {}
    if not titles_per_cluster:
        return out
    cluster_ids = list(titles_per_cluster.keys())
    docs = [" ".join(titles_per_cluster[cid]) for cid in cluster_ids]
    # 한국어는 어미·조사가 많아 char n-gram (2~3) + token 혼합이 안정
    vec = TfidfVectorizer(
        analyzer="char_wb", ngram_range=(2, 4), max_features=5000, min_df=2
    )
    try:
        X = vec.fit_transform(docs)
    except ValueError:
        # 어휘 부족 등
        return {cid: "" for cid in cluster_ids}
    vocab = np.array(vec.get_feature_names_out())
    for idx, cid in enumerate(cluster_ids):
        row = X[idx].toarray().ravel()
        if not row.any():
            out[cid] = ""
            continue
        top_idx = np.argsort(row)[::-1][:top_n]
        # 공백·특수문자만으로 된 ngram 제거
        kw = [vocab[i] for i in top_idx if re.search(r"\w", vocab[i])][:top_n]
        out[cid] = ", ".join(kw)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-host", default=os.environ.get("DB_HOST", "152.69.232.44"))
    ap.add_argument("--db-name", default=os.environ.get("DB_NAME", "jbdatahub"))
    ap.add_argument("--db-user", default=os.environ.get("DB_USER", "postgres"))
    ap.add_argument("--db-pass", default=os.environ.get("DB_PASS", ""))
    ap.add_argument("--n-clusters", type=int, default=30)
    ap.add_argument("--top-keywords", type=int, default=5)
    ap.add_argument("--batch-size", type=int, default=1024)
    args = ap.parse_args()

    conn = psycopg2.connect(
        host=args.db_host, dbname=args.db_name,
        user=args.db_user, password=args.db_pass,
    )
    conn.autocommit = False

    logger.info("fetching embeddings...")
    list_ids, titles, vecs = [], [], []
    for lid, t, v in fetch_all_embeddings(conn):
        list_ids.append(lid)
        titles.append(t)
        vecs.append(v)
    if not vecs:
        logger.warning("no embeddings yet — run embed_initial_batch first")
        sys.exit(0)
    X = np.vstack(vecs)
    logger.info("loaded %d embeddings (dim=%d)", X.shape[0], X.shape[1])

    logger.info("running MiniBatchKMeans n_clusters=%d", args.n_clusters)
    km = MiniBatchKMeans(
        n_clusters=args.n_clusters,
        batch_size=args.batch_size,
        n_init=3,
        random_state=42,
    )
    labels = km.fit_predict(X)

    titles_per_cluster: dict[int, list[str]] = {}
    for cid, t in zip(labels, titles):
        titles_per_cluster.setdefault(int(cid), []).append(t)

    keywords = extract_topic_keywords(titles_per_cluster, top_n=args.top_keywords)

    # api_topic 갱신: 전체 REPLACE (DELETE 후 INSERT)
    with conn.cursor() as cur:
        cur.execute("TRUNCATE api_topic")
        execute_values(
            cur,
            "INSERT INTO api_topic (list_id, topic_id) VALUES %s",
            [(lid, int(cid)) for lid, cid in zip(list_ids, labels)],
        )
        cur.execute("TRUNCATE api_topic_label")
        execute_values(
            cur,
            "INSERT INTO api_topic_label (topic_id, topic_keywords) VALUES %s",
            [(cid, kw) for cid, kw in keywords.items()],
        )
    conn.commit()
    logger.info("done — %d topics applied", len(keywords))


if __name__ == "__main__":
    main()
