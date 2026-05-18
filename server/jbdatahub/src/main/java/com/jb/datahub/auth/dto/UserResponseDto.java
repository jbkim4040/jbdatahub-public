package com.jb.datahub.auth.dto;

import com.jb.datahub.auth.entity.User;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class UserResponseDto {
    private final Long id;
    private final String username;
    private final String role;
    private final boolean active;
    private final LocalDateTime createdAt;

    public UserResponseDto(User u) {
        this.id        = u.getId();
        this.username  = u.getUsername();
        this.role      = u.getRole();
        this.active    = u.isActive();
        this.createdAt = u.getCreatedAt();
    }
}
