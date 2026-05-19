package com.jb.datahub.audit;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository repository;

    @Async
    public void log(String eventType, String username, HttpServletRequest req, String details) {
        try {
            String ip = (req != null) ? extractIp(req) : null;
            AuditLog entry = AuditLog.builder()
                .eventType(eventType)
                .username(username)
                .ipAddress(ip)
                .details(details)
                .build();
            repository.save(entry);
        } catch (Exception e) {
            log.warn("audit log save failed: {}", e.getMessage());
        }
    }

    public void log(String eventType, String username, String details) {
        log(eventType, username, null, details);
    }

    private String extractIp(HttpServletRequest req) {
        String remote = req.getRemoteAddr();
        // forward 헤더는 신뢰된 proxy(loopback/docker bridge/사설망)에서 온 요청에서만 신뢰
        if (isTrustedProxy(remote)) {
            String cfIp = req.getHeader("CF-Connecting-IP");
            if (cfIp != null && !cfIp.isBlank()) return cfIp.trim();
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
            String realIp = req.getHeader("X-Real-IP");
            if (realIp != null && !realIp.isBlank()) return realIp.trim();
        }
        return remote;
    }

    // RFC 1918: 10.0.0.0/8, 172.16.0.0/12 (= 172.16-172.31), 192.168.0.0/16
    // 정규식으로 172.16-31 범위만 정확히 매칭 (172.200.x.x 등 공인 IP 오인 방지)
    private static final java.util.regex.Pattern PRIVATE_172 =
        java.util.regex.Pattern.compile("^172\\.(1[6-9]|2[0-9]|3[01])\\..*");

    private boolean isTrustedProxy(String ip) {
        if (ip == null) return false;
        return "127.0.0.1".equals(ip) || "::1".equals(ip)
            || ip.startsWith("10.") || ip.startsWith("192.168.")
            || PRIVATE_172.matcher(ip).matches();
    }
}
