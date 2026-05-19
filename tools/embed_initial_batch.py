"""초기 70만 건 일회성 임베딩 배치.

실행 위치: embed_service가 떠 있는 Oracle ARM A1 서버에서 실행 권장
(WAS DB 사이의 latency 최소화). CI 서버 부담 0.

실행:
    python3 tools/embed_initial_batch.py \\
        --db-host 152.69.232.44 --db-name jbdatahub \\
        --embed-url http://localhost:8001 \\
        --batch-size 32 --chunk 500

특징:
- restart-safe: title_embedding IS NULL인 row만 처리
- 진행 상황 stdout + 매 chunk마다 commit (중단 시 손실 최소화)
- ARM A1 1코어 기준 약 10시간 예상 (70만 × 50ms)
"""
from __future__ import annotations
import argparse
import json
import logging
import os
import sys
import time
import urllib.request
from typing import List

import psycopg2  # pip install psycopg2-binary
from psycopg2.extras import execute_values

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("embed_batch")


def embed_texts(embed_url: str, texts: List[str]) -> List[List[float]]:
    """embed_service.embed_batch 호출."""
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
    """title_embedding IS NULL인 row를 list_title 기준으로 fetch."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT list_id, COALESCE(list_title, '') "
            "FROM public_api_list "
            "WHERE title_embedding IS NULL AND list_title IS NOT NULL "
            "ORDER BY list_id LIMIT %s",
            (limit,),
        )
        return cur.fetchall()


def update_embeddings(conn, rows: List[tuple]):
    """UPDATE public_api_list SET title_embedding=... WHERE list_id=..."""
    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE public_api_list SET title_embedding = %s::vector WHERE list_id = %s",
            [(json.dumps(emb), list_id) for list_id, emb in rows],
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-host", default=os.environ.get("DB_HOST", "152.69.232.44"))
    ap.add_argument("--db-name", default=os.environ.get("DB_NAME", "jbdatahub"))
    ap.add_argument("--db-user", default=os.environ.get("DB_USER", "postgres"))
    ap.add_argument("--db-pass", default=os.environ.get("DB_PASS", ""))
    ap.add_argument("--embed-url", default=os.environ.get("EMBED_URL", "http://localhost:8001"))
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--chunk", type=int, default=500, help="DB fetch + commit 단위")
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

        # batch_size 단위로 embed
        embeddings_for_update = []
        for i in range(0, len(pending), args.batch_size):
            sub = pending[i:i + args.batch_size]
            texts = [t for _, t in sub]
            try:
                vecs = embed_texts(args.embed_url, texts)
            except Exception as e:
                logger.error("embed call failed at chunk offset %d: %s", i, e)
                time.sleep(5)
                continue
            for (list_id, _), emb in zip(sub, vecs):
                embeddings_for_update.append((list_id, emb))

        update_embeddings(conn, embeddings_for_update)
        conn.commit()
        total += len(embeddings_for_update)
        rate = total / max(time.time() - started, 1)
        logger.info("chunk done: total=%d, rate=%.1f/sec", total, rate)


if __name__ == "__main__":
    main()
