"""embed_service — sentence-transformers 기반 임베딩 FastAPI.

CI/모니터링 서버 부담을 피하기 위해 별도 Oracle Cloud ARM A1 인스턴스에서 운영.
"""
import logging
import os
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel
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


class TextIn(BaseModel):
    text: str


class BatchIn(BaseModel):
    texts: List[str]


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME, "dim": DIM}


@app.post("/embed")
def embed(req: TextIn):
    vec = model.encode(req.text, normalize_embeddings=True)
    return {"embedding": vec.tolist()}


@app.post("/embed_batch")
def embed_batch(req: BatchIn):
    # ARM A1 1코어 기준 batch_size 32가 메모리·속도 균형
    vecs = model.encode(req.texts, batch_size=32, normalize_embeddings=True)
    return {"embeddings": [v.tolist() for v in vecs]}
