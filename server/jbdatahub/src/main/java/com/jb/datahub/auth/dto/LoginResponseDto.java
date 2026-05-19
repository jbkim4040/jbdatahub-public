package com.jb.datahub.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 로그인 응답 — 토큰은 httpOnly 쿠키로만 전송 (Set-Cookie 헤더).
 * body는 사용자 식별 정보만 포함하여 JS 노출 표면 제거.
 */
@Getter
@AllArgsConstructor
public class LoginResponseDto {
    private String username;
    private String role;
}
