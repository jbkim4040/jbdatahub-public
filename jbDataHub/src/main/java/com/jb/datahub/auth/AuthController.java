package com.jb.datahub.auth;

import com.jb.datahub.auth.dto.LoginRequestDto;
import com.jb.datahub.auth.dto.LoginResponseDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "인증 API", description = "관리자 로그인")
public class AuthController {

    private final JwtUtil jwtUtil;

    @Value("${admin.username}")
    private String adminUsername;

    @Value("${admin.password}")
    private String adminPassword;

    @PostMapping("/login")
    @Operation(summary = "관리자 로그인", description = "username / password 검증 후 JWT 반환")
    public ResponseEntity<?> login(@RequestBody LoginRequestDto request) {
        if (!adminUsername.equals(request.getUsername())
                || !adminPassword.equals(request.getPassword())) {
            return ResponseEntity.status(401).body("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        String token = jwtUtil.generateToken(adminUsername, "ADMIN");
        return ResponseEntity.ok(new LoginResponseDto(token, adminUsername, "ADMIN"));
    }
}
