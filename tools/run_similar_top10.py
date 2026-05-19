"""사전 계산된 유사도 Top-10 배치.

각 데이터셋에 대해 코사인 유사도 상위 10개를 미리 계산해 `api_similar`에 INSERT.
운영 시 `SemanticSearchService.getSimilar(listId)`가 이 테이블을 그대로 조회.

embed 서버에서 실행 권장. 70만 건 기준 약 5~15분 (numpy 벡터화).

실행:
    python3 tools/run_similar_top10.py --top-k 10
"""
from __future__ import annotations
import argparse
import json
import logging
import os
import sys

import numpy as np
import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("similar")


def fetch_all(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT list_id, title_embedding::text "
            "FROM public_api_list WHERE title_embedding IS NOT NULL"
        )
        ids, vecs = [], []
        for lid, emb_str in cur:
            ids.append(lid)
            vecs.append(np.array(json.loads(emb_str), dtype=np.float32))
    return ids, np.vstack(vecs) if vecs else np.empty((0, 384), dtype=np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-host", default=os.environ.get("DB_HOST", "152.69.232.44"))
    ap.add_argument("--db-name", default=os.environ.get("DB_NAME", "jbdatahub"))
    ap.add_argument("--db-user", default=os.environ.get("DB_USER", "postgres"))
    ap.add_argument("--db-pass", default=os.environ.get("DB_PASS", ""))
    ap.add_argument("--top-k", type=int, default=10)
    ap.add_argument("--chunk", type=int, default=2000, help="메모리 절약용 청크 크기")
    args = ap.parse_args()

    conn = psycopg2.connect(
        host=args.db_host, dbname=args.db_name,
        user=args.db_user, password=args.db_pass,
    )
    conn.autocommit = False

    logger.info("loading...")
    ids, X = fetch_all(conn)
    if len(ids) == 0:
        logger.warning("no embeddings yet — run embed_initial_batch first")
        sys.exit(0)
    logger.info("loaded %d × %d", X.shape[0], X.shape[1])

    # 임베딩이 normalize 되어 있다고 가정 (embed_service에서 normalize_embeddings=True)
    # 그래도 안전하게 한 번 더 normalize
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    X = X / norms

    # 청크로 dot product → top-k 추출
    with conn.cursor() as cur:
        cur.execute("TRUNCATE api_similar")

    rows_buffer = []
    for start in range(0, X.shape[0], args.chunk):
        end = min(start + args.chunk, X.shape[0])
        sub = X[start:end]
        sim = sub @ X.T  # (chunk, N)
        # 자기 자신 제외
        for local_i in range(sim.shape[0]):
            global_i = start + local_i
            sim[local_i, global_i] = -1.0
        # top-k indices per row
        topk_idx = np.argpartition(-sim, args.top_k, axis=1)[:, : args.top_k]
        # row 정렬
        for local_i, top in enumerate(topk_idx):
            global_i = start + local_i
            scores = sim[local_i, top]
            # 점수 내림차순 정렬
            order = np.argsort(-scores)
            for j in order:
                similar_id = ids[top[j]]
                score = float(scores[j])
                rows_buffer.append((ids[global_i], similar_id, score))
        # 청크 commit
        if rows_buffer:
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    "INSERT INTO api_similar (list_id, similar_id, score) VALUES %s "
                    "ON CONFLICT (list_id, similar_id) DO UPDATE SET score=EXCLUDED.score",
                    rows_buffer,
                )
            conn.commit()
            logger.info("commit chunk %d-%d (%d pairs)", start, end, len(rows_buffer))
            rows_buffer = []

    logger.info("done")


if __name__ == "__main__":
    main()
