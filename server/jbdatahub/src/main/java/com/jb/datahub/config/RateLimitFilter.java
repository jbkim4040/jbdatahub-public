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

    private static final int  MAX_RPM              = 200;
    private static final int  INVOKE_MAX_RPM       = 20;  // 외부 HTTP 호출이므로 더 엄격하게
    private static final int  VALIDATE_KEY_MAX_RPM = 5;   // 서비스 키 열거 방지
    private static final long WINDOW_MS            = 60_000L;

    private final ConcurrentHashMap<String, Deque<Long>> store           = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Long>> invokeStore     = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Long>> validateKeyStore = new ConcurrentHashMap<>();

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

        // /invoke 전용 엄격한 제한 (분당 20건) — 외부 API 남용 방지
        if ("/api/public-data/invoke".equals(req.getRequestURI())) {
            Deque<Long> invTs = invokeStore.computeIfAbsent(ip, k -> new ArrayDeque<>());
            synchronized (invTs) {
                while (!invTs.isEmpty() && invTs.peekFirst() < now - WINDOW_MS) invTs.pollFirst();
                if (invTs.size() >= INVOKE_MAX_RPM) {
                    res.setStatus(429);
                    res.addHeader("Retry-After", "60");
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write(
                        "{\"error\":\"Too Many Requests\",\"message\":\"API 호출은 분당 최대 "
                        + INVOKE_MAX_RPM + "건 가능합니다.\"}");
                    return;
                }
                invTs.addLast(now);
            }
        }

        // /validate-key 전용 엄격한 제한 (분당 5건) — 서비스 키 열거 방지
        if ("/api/auth/validate-key".equals(req.getRequestURI())) {
            Deque<Long> vkTs = validateKeyStore.computeIfAbsent(ip, k -> new ArrayDeque<>());
            synchronized (vkTs) {
                while (!vkTs.isEmpty() && vkTs.peekFirst() < now - WINDOW_MS) vkTs.pollFirst();
                if (vkTs.size() >= VALIDATE_KEY_MAX_RPM) {
                    res.setStatus(429);
                    res.addHeader("Retry-After", "60");
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write(
                        "{\"error\":\"Too Many Requests\",\"message\":\"서비스 키 검증은 분당 최대 "
                        + VALIDATE_KEY_MAX_RPM + "건 가능합니다.\"}");
                    return;
                }
                vkTs.addLast(now);
            }
        }

        Deque<Long> ts = store.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (ts) {
            while (!ts.isEmpty() && ts.peekFirst() < now - WINDOW_MS) ts.pollFirst();
            if (ts.size() >= MAX_RPM) {
                res.setStatus(429);
                res.addHeader("Retry-After", "60");
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

    /**
     * remoteAddr가 신뢰 프록시(Docker 내부망, 로컬) 출처일 때만 proxy 헤더를 채택.
     * 직접 접근(공인 IP)이면 헤더 위조 가능 → remoteAddr 그대로 사용.
     */
    private String getClientIp(HttpServletRequest req) {
        String remoteAddr = req.getRemoteAddr();
        if (!isTrustedProxy(remoteAddr)) return remoteAddr;

        // Cloudflare 우선 (CF-Connecting-IP)
        String cfIp = req.getHeader("CF-Connecting-IP");
        if (cfIp != null && !cfIp.isBlank()) return cfIp.trim();
        // nginx X-Real-IP
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        // X-Forwarded-For: 첫 번째 값 (appended by nginx, not spoofable from outside)
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return remoteAddr;
    }

    /** Docker 내부망(172.16-31.x, 10.x), loopback, private 대역만 신뢰 */
    private boolean isTrustedProxy(String addr) {
        if (addr == null) return false;
        return addr.startsWith("127.") || addr.startsWith("::1")
            || addr.startsWith("10.")
            || isTrustedDocker172(addr)
            || addr.startsWith("192.168.");
    }

    /** RFC-1918: 172.16.0.0/12 (172.16.x.x ~ 172.31.x.x) 만 허용 */
    private boolean isTrustedDocker172(String addr) {
        if (!addr.startsWith("172.")) return false;
        String[] parts = addr.split("\\.");
        if (parts.length < 2) return false;
        try {
            int second = Integer.parseInt(parts[1]);
            return second >= 16 && second <= 31;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /** 5분마다 만료된 IP 항목 정리 (메모리 누수 방지) */
    @Scheduled(fixedDelay = 300_000)
    public void cleanup() {
        long cutoff = System.currentTimeMillis() - WINDOW_MS;
        evictExpired(store, cutoff);
        evictExpired(invokeStore, cutoff);
        evictExpired(validateKeyStore, cutoff);
    }

    private void evictExpired(ConcurrentHashMap<String, Deque<Long>> map, long cutoff) {
        map.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().stream().allMatch(t -> t < cutoff);
            }
        });
    }
}
