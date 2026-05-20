-- Access Token 블랙리스트 영속화 — Blue/Green 배포(컨테이너 재시작) 시
-- 인메모리 블랙리스트 소실로 로그아웃된 토큰이 만료까지 부활하는 문제 방지.
CREATE TABLE IF NOT EXISTS token_blacklist (
  token_hash  varchar(64)  PRIMARY KEY,   -- SHA-256 hex (원본 토큰 미저장)
  expires_at  timestamptz  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires
  ON token_blacklist (expires_at);
COMMENT ON TABLE token_blacklist IS '로그아웃 access token blacklist — SHA-256 해시만 저장';
