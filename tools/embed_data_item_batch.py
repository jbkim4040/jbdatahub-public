"""public_data_item 308K건 임베딩 배치.

embed 서버 (= DB 서버)에서 실행. cgroup 0.7 CPU 기준 ~4~6시간.

실행:
    DB_HOST=127.0.0.1 DB_USER=jbdatahub DB_NAME=jbdatahub DB_PASS=... \
    EMBED_URL=http://localhost:8001 \
    nohup python3 tools/embed_data_item_batch.py > /tmp/embed_di_batch.log 2>&1 &
"""
from __future__ import annotations
import argparse
import json
import logging
import os
import time
import urllib.request
from typing import List

import psycopg2

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("embed_di_batch")


def embed_texts(embed_url: str, texts: List[str]) -> List[List[float]]:
    req = urllib.request.Request(
        f"{embed_url}/embed_batch",
        data=json.dumps({"texts": texts}).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    return d["embeddings"]


def fetch_pending(conn, limit: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, COALESCE(title, list_title, '') FROM public_data_item "
            "WHERE title_embedding IS NULL "
            "  AND (title IS NOT NULL OR list_title IS NOT NULL) "
            "ORDER BY id LIMIT %s",
            (limit,),
        )
        return cur.fetchall()


def update_embeddings(conn, rows):
    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE public_data_item SET title_embedding = %s::vector WHERE id = %s",
            [(json.dumps(emb), item_id) for item_id, emb in rows],
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-host", default=os.environ.get("DB_HOST", "152.69.232.44"))
    ap.add_argument("--db-name", default=os.environ.get("DB_NAME", "jbdatahub"))
    ap.add_argument("--db-user", default=os.environ.get("DB_USER", "postgres"))
    ap.add_argument("--db-pass", default=os.environ.get("DB_PASS", ""))
    ap.add_argument("--embed-url", default=os.environ.get("EMBED_URL", "http://localhost:8001"))
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--chunk", type=int, default=500)
    args = ap.parse_args()

    conn = psycopg2.connect(
        host=args.db_host, dbname=args.db_name,
        user=args.db_user, password=args.db_pass,
    )
    conn.autocommit = False

    total = 0
    started = time.time()
    while True:
        pending = fetch_pending(conn, args.chunk)
        if not pending:
            logger.info("done, total=%d, elapsed=%.1fmin", total, (time.time() - started) / 60)
            break
        rows_for_update = []
        for i in range(0, len(pending), args.batch_size):
            sub = pending[i:i + args.batch_size]
            texts = [t for _, t in sub]
            try:
                vecs = embed_texts(args.embed_url, texts)
            except Exception as e:
                logger.error("embed call failed: %s", e)
                time.sleep(5)
                continue
            for (item_id, _), emb in zip(sub, vecs):
                rows_for_update.append((item_id, emb))
        update_embeddings(conn, rows_for_update)
        conn.commit()
        total += len(rows_for_update)
        rate = total / max(time.time() - started, 1)
        eta_min = (308000 - total) / rate / 60 if rate > 0 else 0
        logger.info("chunk done: total=%d, rate=%.1f/sec, eta=%.0fmin", total, rate, eta_min)


if __name__ == "__main__":
    main()
