-- 스케줄러 분산 락 — Blue/Green 배포 오버랩 중 @Scheduled 잡 중복 실행 방지
CREATE TABLE IF NOT EXISTS scheduler_lock (
  lock_name    varchar(64)  PRIMARY KEY,
  locked_until timestamptz  NOT NULL,
  locked_by    varchar(128)
);
COMMENT ON TABLE scheduler_lock IS 'ShedLock 유사 — INSERT ON CONFLICT WHERE locked_until<now() 로 단일 인스턴스 보장';
