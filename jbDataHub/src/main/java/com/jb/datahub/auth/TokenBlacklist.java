package com.jb.datahub.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Access Token 블랙리스트 — 로그아웃 시 토큰 즉시 무효화
 * 만료된 항목은 조회 시 lazy 삭제, 15분 TTL 맞춤
 */
@Component
public class TokenBlacklist {

    private final Map<String, Instant> store = new ConcurrentHashMap<>();

    public void add(String token, Instant expiresAt) {
        store.put(token, expiresAt);
    }

    public boolean isBlacklisted(String token) {
        Instant exp = store.get(token);
        if (exp == null) return false;
        if (Instant.now().isAfter(exp)) {
            store.remove(token);
            return false;
        }
        return true;
    }
}
