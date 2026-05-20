"""embed_service — sentence-transformers 기반 임베딩 FastAPI.

CI/모니터링 서버 부담을 피하기 위해 별도 Oracle Cloud ARM A1 인스턴스에서 운영.
"""
import logging
import os
from typing import List

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, constr, conlist
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("embed_service")

MODEL_NAME = os.environ.get(
    "EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)
# 384차원, 약 120MB, 한국어 포함 50+ 언어 지원
logger.info("loading model: %s", MODEL_NAME)
model = SentenceTransformer(MODEL_NAME)
DIM = model.get_sentence_embedding_dimension()
logger.info("model loaded, dim=%d", DIM)

app = FastAPI(title="jbdatahub embed_service", version="1.0.0")

INTERNAL_TOKEN = os.environ.get("INTERNAL_TOKEN")  # 운영에선 .env 에서 강제
MAX_TEXT_LEN   = int(os.environ.get("EMBED_MAX_TEXT_LEN", "500"))
MAX_BATCH      = int(os.environ.get("EMBED_MAX_BATCH", "64"))
if not INTERNAL_TOKEN:
    logger.warning(
        "INTERNAL_TOKEN 환경변수 미설정 — dev 모드. 운영에서는 반드시 설정 필요"
    )


def require_internal_token(x_internal_token: str | None):
    if not INTERNAL_TOKEN:
        return
    if x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="invalid internal token")


class TextIn(BaseModel):
    text: constr(strip_whitespace=True, min_length=1, max_length=MAX_TEXT_LEN)


class BatchIn(BaseModel):
    texts: conlist(
        constr(strip_whitespace=True, min_length=1, max_length=MAX_TEXT_LEN),
        min_length=1, max_length=MAX_BATCH,
    )


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME, "dim": DIM}


@app.post("/embed")
def embed(req: TextIn, x_internal_token: str | None = Header(default=None)):
    require_internal_token(x_internal_token)
    vec = model.encode(req.text, normalize_embeddings=True)
    return {"embedding": vec.tolist()}


@app.post("/embed_batch")
def embed_batch(req: BatchIn, x_internal_token: str | None = Header(default=None)):
    require_internal_token(x_internal_token)
    # ARM A1 1코어 기준 batch_size 32가 메모리·속도 균형
    vecs = model.encode(req.texts, batch_size=32, normalize_embeddings=True)
    return {"embeddings": [v.tolist() for v in vecs]}
