package com.jb.datahub.auth;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Access Token 블랙리스트 — 로그아웃 시 토큰 즉시 무효화.
 *
 * 인메모리 맵(빠른 조회) + DB 테이블(영속) 이중 구조:
 *  - 인메모리: 토큰 SHA-256 해시 → 만료시각. 조회는 전부 인메모리(요청당 DB 쿼리 0).
 *  - DB: add() 시 함께 기록. 컨테이너 시작 시 @PostConstruct 로 인메모리에 복원.
 *  → Blue/Green 배포(컨테이너 재시작) 후에도 로그아웃 토큰이 계속 차단됨.
 *
 * DB 오류/테이블 부재 시 인메모리만으로 degrade — 단일 컨테이너에선 무해.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TokenBlacklist {

    private final JdbcTemplate jdbcTemplate;

    /** key = 토큰 SHA-256 해시, value = 만료시각 */
    private final Map<String, Instant> store = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadFromDb() {
        try {
            jdbcTemplate.query(
                "SELECT token_hash, expires_at FROM token_blacklist WHERE expires_at > now()",
                rs -> {
                    store.put(rs.getString("token_hash"),
                              rs.getTimestamp("expires_at").toInstant());
                });
            log.info("TokenBlacklist — DB에서 {}건 복원", store.size());
        } catch (Exception e) {
            log.warn("TokenBlacklist DB 복원 실패 (인메모리만 사용): {}", e.getMessage());
        }
    }

    public void add(String token, Instant expiresAt) {
        String hash = sha256(token);
        store.put(hash, expiresAt);
        try {
            jdbcTemplate.update(
                "INSERT INTO token_blacklist (token_hash, expires_at) VALUES (?, ?) " +
                "ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at",
                hash, Timestamp.from(expiresAt));
        } catch (Exception e) {
            log.warn("TokenBlacklist DB 기록 실패 (인메모리만): {}", e.getMessage());
        }
    }

    public boolean isBlacklisted(String token) {
        String hash = sha256(token);
        Instant exp = store.get(hash);
        if (exp == null) return false;
        if (Instant.now().isAfter(exp)) {
            store.remove(hash);
            return false;
        }
        return true;
    }

    /** 만료 항목 정리 — 매일 04시 (인메모리 + DB) */
    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    public void cleanupExpired() {
        Instant now = Instant.now();
        store.entrySet().removeIf(e -> now.isAfter(e.getValue()));
        try {
            int deleted = jdbcTemplate.update(
                "DELETE FROM token_blacklist WHERE expires_at < now()");
            if (deleted > 0) log.info("TokenBlacklist 만료 {}건 정리", deleted);
        } catch (Exception e) {
            log.warn("TokenBlacklist DB 정리 실패: {}", e.getMessage());
        }
    }

    private String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : h) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 사용 불가", e);
        }
    }
}
