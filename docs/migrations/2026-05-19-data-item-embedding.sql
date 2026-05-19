-- Phase 3-B: public_data_item 임베딩 (dataset / file-data / standard-data)
-- 적용:
--   ssh -i ~/Downloads/jbdbkey.key ubuntu@152.69.232.44 \
--     "sudo -u postgres psql -d jbdatahub -f /dev/stdin" \
--     < docs/migrations/2026-05-19-data-item-embedding.sql
-- 적용 후 backfill:
--   python3 tools/embed_data_item_batch.py (약 4~6시간)

ALTER TABLE public_data_item
  ADD COLUMN IF NOT EXISTS title_embedding vector(384);

-- 308K건 — lists=300 (sqrt(308000)≈555, 권장 100~1000)
CREATE INDEX IF NOT EXISTS idx_pdi_title_embedding
  ON public_data_item USING ivfflat (title_embedding vector_cosine_ops)
  WITH (lists = 300);

-- jbdatahub 사용자가 새 컬럼 읽기/쓰기 가능하도록 (테이블 owner라 자동)
-- 확인용: SELECT COUNT(*) FILTER (WHERE title_embedding IS NOT NULL) FROM public_data_item;
