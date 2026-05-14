package com.jb.datahub.auth.dto;

import lombok.Getter;

@Getter
public class UserCreateDto {
    private String username;
    private String password;
    private String role; // ADMIN / USER
}
