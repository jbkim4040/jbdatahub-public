FROM python:3.12-slim

WORKDIR /app

# 빌드 안정성 (huggingface_hub, tokenizers 등)
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_OFFLINE=0

RUN pip install --upgrade pip && \
    pip install fastapi uvicorn[standard] pydantic sentence-transformers

COPY main.py .

# 모델 사전 다운로드 (이미지 layer에 캐시)
RUN python -c "from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

EXPOSE 8001

# 1 worker — 모델이 RAM 500MB+, ARM A1 4GB에서 worker 늘리면 OOM 위험
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
