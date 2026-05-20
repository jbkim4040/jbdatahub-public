-- 임베딩 최신성 추적 — 데이터셋 title 변경 시 재임베딩 트리거용.
-- embedded_at < updated_at 이면 임베딩이 stale → 백필 스케줄러가 재처리.
ALTER TABLE public_api_list   ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
ALTER TABLE public_data_item  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

-- 이미 임베딩된 row 는 현재 시각으로 초기화 (불필요한 전량 재임베딩 방지)
UPDATE public_api_list  SET embedded_at = now()
  WHERE title_embedding IS NOT NULL AND embedded_at IS NULL;
UPDATE public_data_item SET embedded_at = now()
  WHERE title_embedding IS NOT NULL AND embedded_at IS NULL;
