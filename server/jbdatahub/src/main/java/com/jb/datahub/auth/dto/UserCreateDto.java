package com.jb.datahub.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class UserCreateDto {

    @NotBlank(message = "username 필수")
    @Size(min = 3, max = 50, message = "username 3~50자")
    @Pattern(regexp = "^[A-Za-z0-9_.-]+$", message = "username 영문/숫자/._- 만 허용")
    private String username;

    @NotBlank(message = "password 필수")
    @Size(min = 8, max = 100, message = "password 8자 이상")
    private String password;

    @Pattern(regexp = "^(ADMIN|USER|GUEST)$", message = "role 는 ADMIN/USER/GUEST")
    private String role;
}
