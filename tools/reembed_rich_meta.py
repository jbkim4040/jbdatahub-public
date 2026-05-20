"""rich-meta 재임베딩 배치 — 기존 전체 row 를 메타정보 포함 텍스트로 재임베딩.

임베딩 텍스트 = 제목 + 키워드 + 분류 + 기관 + 설명 (500자 cap).
EmbeddingBackfillScheduler 와 동일 공식.

DB 서버에서 1회 실행:
    DB_HOST=127.0.0.1 DB_USER=jbdatahub DB_NAME=jbdatahub DB_PASS=... \
    EMBED_URL=http://localhost:8001 INTERNAL_TOKEN=... \
    python3 reembed_rich_meta.py
"""
import os, sys, time, json, logging
import urllib.request
import psycopg2

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("reembed")

DB = dict(host=os.environ.get("DB_HOST", "127.0.0.1"),
          user=os.environ["DB_USER"], password=os.environ["DB_PASS"],
          dbname=os.environ["DB_NAME"])
EMBED_URL = os.environ.get("EMBED_URL", "http://localhost:8001")
TOKEN = os.environ.get("INTERNAL_TOKEN", "")
BATCH = 32
MAX_LEN = 500

TABLES = [
    ("public_api_list", "list_id",
     "list_title, keywords, new_category_nm, org_nm, description"),
    ("public_data_item", "id",
     "title AS list_title, keywords, "
     "COALESCE(new_category_nm, category_nm) AS new_category_nm, org_nm, description"),
]


def build_text(row):
    parts = [str(v).strip() for v in row if v and str(v).strip()]
    text = " ".join(parts)
    return text[:MAX_LEN]


def embed_batch(texts):
    body = json.dumps({"texts": texts}).encode()
    req = urllib.request.Request(EMBED_URL + "/embed_batch", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if TOKEN:
        req.add_header("X-Internal-Token", TOKEN)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["embeddings"]


def reembed(conn, table, id_col, meta_cols):
    # meta_cols 의 첫 컬럼들 (list_title..description) — id 제외
    sel = f"SELECT {id_col} AS id, {meta_cols} FROM {table} " \
          f"WHERE COALESCE(is_deleted,'N')='N'"
    with conn.cursor() as cur:
        cur.execute(sel)
        rows = cur.fetchall()
    log.info("%s — %d건 재임베딩 시작", table, len(rows))
    total = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        ids = [r[0] for r in chunk]
        texts = [build_text(r[1:]) for r in chunk]
        try:
            vecs = embed_batch(texts)
        except Exception as e:
            log.warning("embed 실패 chunk %d: %s — 스킵", i, e)
            continue
        with conn.cursor() as cur:
            for rid, vec in zip(ids, vecs):
                vstr = "[" + ",".join(str(x) for x in vec) + "]"
                cur.execute(
                    f"UPDATE {table} SET title_embedding = CAST(%s AS vector), "
                    f"embedded_at = now() WHERE {id_col} = %s", (vstr, rid))
        conn.commit()
        total += len(chunk)
        if total % 1000 < BATCH:
            log.info("%s — %d/%d", table, total, len(rows))
    log.info("%s — 완료 %d건", table, total)


def main():
    conn = psycopg2.connect(**DB)
    t0 = time.time()
    for table, id_col, meta_cols in TABLES:
        reembed(conn, table, id_col, meta_cols)
    conn.close()
    log.info("전체 완료 — %.1f분", (time.time() - t0) / 60)


if __name__ == "__main__":
    main()
