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
 * /api/auth/login   : 10/min (브루트포스 방어)
 * /api/auth/refresh : 30/min (토큰 자동 갱신 허용)
 * /api/**           : 200/min
 */
@Component
@Order(2)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int  MAX_RPM         = 200;
    private static final int  LOGIN_MAX_RPM   = 10;
    private static final int  REFRESH_MAX_RPM = 30;
    private static final long WINDOW_MS       = 60_000L;

    private final ConcurrentHashMap<String, Deque<Long>> store        = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Long>> loginStore   = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Long>> refreshStore = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws IOException, ServletException {
        String uri = req.getRequestURI();
        if (!uri.startsWith("/api/")) {
            chain.doFilter(req, res);
            return;
        }

        String ip  = getClientIp(req);
        long   now = System.currentTimeMillis();

        ConcurrentHashMap<String, Deque<Long>> target;
        int limit;
        if (uri.startsWith("/api/auth/login")) {
            target = loginStore;
            limit  = LOGIN_MAX_RPM;
        } else if (uri.startsWith("/api/auth/refresh")) {
            target = refreshStore;
            limit  = REFRESH_MAX_RPM;
        } else {
            target = store;
            limit  = MAX_RPM;
        }

        Deque<Long> ts = target.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (ts) {
            while (!ts.isEmpty() && ts.peekFirst() < now - WINDOW_MS) ts.pollFirst();
            if (ts.size() >= limit) {
                res.setStatus(429);
                res.setContentType("application/json;charset=UTF-8");
                res.getWriter().write(
                    "{\"error\":\"Too Many Requests\",\"message\":\"분당 최대 " + limit + "건 요청 가능합니다.\"}"
                );
                return;
            }
            ts.addLast(now);
        }

        chain.doFilter(req, res);
    }

    private String getClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : req.getRemoteAddr();
    }

    /** 5분마다 만료된 IP 항목 정리 (메모리 누수 방지) */
    @Scheduled(fixedDelay = 300_000)
    public void cleanup() {
        long cutoff = System.currentTimeMillis() - WINDOW_MS;
        for (ConcurrentHashMap<String, Deque<Long>> s : new ConcurrentHashMap[]{loginStore, refreshStore, store}) {
            s.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    return e.getValue().stream().allMatch(t -> t < cutoff);
                }
            });
        }
    }
}
