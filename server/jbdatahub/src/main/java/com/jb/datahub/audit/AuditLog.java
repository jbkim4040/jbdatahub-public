package com.jb.datahub.audit;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 보안 audit log: 로그인/실패, 권한 변경, 토큰 발급/취소 등.
 */
@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_username", columnList = "username"),
    @Index(name = "idx_audit_event_type", columnList = "eventType"),
    @Index(name = "idx_audit_created_at", columnList = "createdAt")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String eventType;   // LOGIN_SUCCESS, LOGIN_FAIL, ROLE_CHANGE, TOKEN_REVOKE, USER_DELETE 등

    @Column(length = 50)
    private String username;

    @Column(length = 45)
    private String ipAddress;   // IPv6 대응

    @Column(length = 500)
    private String details;     // JSON 또는 문자열

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
