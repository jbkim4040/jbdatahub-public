package com.jb.datahub.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * IP 기반 슬라이딩 윈도우 Rate Limiter.
 * /api/** 경로에만 적용. 기본: 분당 200건.
 */
@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int  MAX_RPM   = 200;
    private static final long WINDOW_MS = 60_000L;

    private final ConcurrentHashMap<String, Deque<Long>> store = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws IOException, ServletException {
        if (!req.getRequestURI().startsWith("/api/")) {
            chain.doFilter(req, res);
            return;
        }

        String ip  = getClientIp(req);
        long   now = System.currentTimeMillis();

        Deque<Long> ts = store.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (ts) {
            while (!ts.isEmpty() && ts.peekFirst() < now - WINDOW_MS) ts.pollFirst();
            if (ts.size() >= MAX_RPM) {
                res.setStatus(429);
                res.setContentType("application/json;charset=UTF-8");
                res.getWriter().write(
                    "{\"error\":\"Too Many Requests\",\"message\":\"분당 최대 " + MAX_RPM + "건 요청 가능합니다.\"}"
                );
                return;
            }
            ts.addLast(now);
        }

        chain.doFilter(req, res);
    }

    /** M2 fix: nginx만 X-Real-IP/X-Forwarded-For 설정 가능하다고 신뢰.
     *  Cloudflare 통과 시 CF-Connecting-IP 우선. 둘 다 nginx에서 검증된 단일 값. */
    private String getClientIp(HttpServletRequest req) {
        // Cloudflare 우선 (CF가 직접 서명한 헤더)
        String cfIp = req.getHeader("CF-Connecting-IP");
        if (cfIp != null && !cfIp.isBlank()) return cfIp.trim();
        // nginx가 한 번만 set한 X-Real-IP
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        // X-Forwarded-For: 첫 번째 값이 진짜 클라이언트 (마지막은 신뢰할 수 없음 — 스푸핑 가능)
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] parts = xff.split(",");
            return parts[0].trim();
        }
        return req.getRemoteAddr();
    }

    /** 5분마다 만료된 IP 항목 정리 (메모리 누수 방지) */
    @Scheduled(fixedDelay = 300_000)
    public void cleanup() {
        long cutoff = System.currentTimeMillis() - WINDOW_MS;
        store.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().stream().allMatch(t -> t < cutoff);
            }
        });
    }
}
