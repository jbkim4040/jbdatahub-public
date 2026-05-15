package com.jb.datahub.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 사용자별 토큰 강제 무효화 저장소
 * - 계정 삭제/비활성화/강제 로그아웃 시 해당 username의 "취소 시각"을 저장
 * - JwtFilter에서 토큰 발급 시각이 취소 시각 이전이면 거부
 */
@Component
public class UserTokenRevocationStore {

    private final Map<String, Instant> revokedAt = new ConcurrentHashMap<>();

    public void revoke(String username) {
        revokedAt.put(username, Instant.now());
    }

    /** tokenIssuedAt 이 취소 시각 이전이면 true (무효화된 토큰) */
    public boolean isRevoked(String username, Instant tokenIssuedAt) {
        Instant rev = revokedAt.get(username);
        return rev != null && !tokenIssuedAt.isAfter(rev);
    }
}
