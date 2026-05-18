package com.jb.datahub.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class LoginRequestDto {
    @NotBlank @Size(max = 50)  private String username;
    @NotBlank @Size(max = 100) private String password;
}
