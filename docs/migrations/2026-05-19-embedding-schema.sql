-- Phase 2: 임베딩 + K-means topic 인프라 DB 스키마
-- 적용 위치: jbdatahub 운영 PostgreSQL (152.69.232.44)
-- 적용 명령:
--   ssh -i ~/Downloads/jbdbkey.key ubuntu@152.69.232.44 \
--     "sudo -u postgres psql -d jbdatahub -f /dev/stdin" < docs/migrations/2026-05-19-embedding-schema.sql

-- pgvector 확장 (이미 0.6.0 설치됨, IF NOT EXISTS 안전)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. public_api_list.title_embedding (384차원, normalize 된 벡터)
ALTER TABLE public_api_list
  ADD COLUMN IF NOT EXISTS title_embedding vector(384);

-- IVFFlat 인덱스 — 코사인 거리 ANN 검색 가속
-- lists = 100: 70만 데이터 / sqrt(700000) ≈ 836, 100~1000 권장 범위 내
-- 인덱스 빌드 전에 데이터가 어느 정도 있어야 효과적 — 초기 배치 임베딩 완료 후 다시 REINDEX 권장
CREATE INDEX IF NOT EXISTS idx_pal_title_embedding
  ON public_api_list USING ivfflat (title_embedding vector_cosine_ops)
  WITH (lists = 100);

-- 2. K-means topic 그룹
CREATE TABLE IF NOT EXISTS api_topic (
  list_id    varchar(20) PRIMARY KEY REFERENCES public_api_list(list_id) ON DELETE CASCADE,
  topic_id   integer NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_topic_topic_id ON api_topic(topic_id);

CREATE TABLE IF NOT EXISTS api_topic_label (
  topic_id        integer PRIMARY KEY,
  topic_keywords  text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. 사전 계산된 유사도 Top-10
CREATE TABLE IF NOT EXISTS api_similar (
  list_id     varchar(20) NOT NULL REFERENCES public_api_list(list_id) ON DELETE CASCADE,
  similar_id  varchar(20) NOT NULL,
  score       double precision NOT NULL,
  PRIMARY KEY (list_id, similar_id)
);
CREATE INDEX IF NOT EXISTS idx_api_similar_list_id ON api_similar(list_id);

-- 검증 쿼리
-- SELECT extname, extversion FROM pg_extension WHERE extname='vector';
-- \d public_api_list
-- SELECT COUNT(*) FROM api_topic;
-- SELECT COUNT(*) FROM api_similar;
