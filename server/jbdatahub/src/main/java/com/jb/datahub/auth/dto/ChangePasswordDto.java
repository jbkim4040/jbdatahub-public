package com.jb.datahub.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class ChangePasswordDto {

    @NotBlank(message = "newPassword 필수")
    @Size(min = 8, max = 100, message = "password 8자 이상")
    private String newPassword;
}
