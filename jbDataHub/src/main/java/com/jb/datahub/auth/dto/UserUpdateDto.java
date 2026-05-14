package com.jb.datahub.auth.dto;

import lombok.Getter;

@Getter
public class UserUpdateDto {
    private String role;    // ADMIN / USER (null = 변경 안 함)
    private Boolean active; // null = 변경 안 함
}
