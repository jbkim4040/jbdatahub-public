package com.jb.datahub.publicdata.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 스케줄러 분산 락 — Blue/Green 배포 시 구·신 컨테이너가 동시 가동되는
 * 오버랩 구간 동안 @Scheduled 잡이 중복 실행되는 것을 방지한다.
 *
 * 동작: scheduler_lock 테이블에 INSERT ... ON CONFLICT DO UPDATE
 *       ... WHERE locked_until < now() — 단 하나의 인스턴스만 갱신 성공.
 * 락 테이블이 없거나 DB 오류 시 true 반환 (degrade-safe — 단일 컨테이너에선 무해).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SchedulerLock {

    private final JdbcTemplate jdbcTemplate;
    private static final String INSTANCE_ID = UUID.randomUUID().toString().substring(0, 8);

    /**
     * 락 획득 시도. 성공 시 true. 실패(타 인스턴스 점유) 시 false.
     * @param lockName   락 이름 (스케줄러별 고유)
     * @param ttlSeconds 락 유효 시간 — 보유 인스턴스 crash 시 자동 만료 (스케줄 주기보다 약간 짧게)
     */
    public boolean tryAcquire(String lockName, long ttlSeconds) {
        try {
            int updated = jdbcTemplate.update(
                "INSERT INTO scheduler_lock (lock_name, locked_until, locked_by) " +
                "VALUES (?, now() + (? || ' seconds')::interval, ?) " +
                "ON CONFLICT (lock_name) DO UPDATE SET " +
                "  locked_until = EXCLUDED.locked_until, locked_by = EXCLUDED.locked_by " +
                "WHERE scheduler_lock.locked_until < now()",
                lockName, String.valueOf(ttlSeconds), INSTANCE_ID);
            return updated > 0;
        } catch (Exception e) {
            log.warn("SchedulerLock '{}' 획득 중 오류 — 락 없이 진행: {}", lockName, e.getMessage());
            return true;
        }
    }
}
