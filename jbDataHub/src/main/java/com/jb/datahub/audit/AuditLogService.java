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
        String cfIp = req.getHeader("CF-Connecting-IP");
        if (cfIp != null && !cfIp.isBlank()) return cfIp.trim();
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        return req.getRemoteAddr();
    }
}
