package com.jb.datahub.auth.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import java.time.Instant;

@Getter
public class UserUpdateDto {
    @Pattern(regexp = "^(ADMIN|USER|GUEST)$", message = "role 은 ADMIN/USER/GUEST 중 하나")
    private String role;       // null = 변경 안 함
    private Boolean active;    // null = 변경 안 함
    private Instant expiresAt; // null = 변경 안 함, 과거 시각 = 즉시 만료
}
