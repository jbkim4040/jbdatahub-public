package com.jb.datahub.auth;

import com.jb.datahub.auth.dto.LoginRequestDto;
import com.jb.datahub.auth.dto.LoginResponseDto;
import com.jb.datahub.auth.dto.RefreshRequestDto;
import com.jb.datahub.auth.entity.RefreshToken;
import com.jb.datahub.auth.entity.User;
import com.jb.datahub.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "인증 API", description = "로그인 / 토큰 갱신 / 로그아웃")
public class AuthController {

    private final JwtUtil              jwtUtil;
    private final UserRepository       userRepository;
    private final PasswordEncoder      passwordEncoder;
    private final RefreshTokenService  refreshTokenService;

    @PostMapping("/login")
    @Operation(summary = "로그인", description = "username / password 검증 후 JWT + refreshToken 반환")
    public ResponseEntity<?> login(@RequestBody LoginRequestDto request) {
        User user = userRepository.findByUsername(request.getUsername()).orElse(null);
        if (user == null || !user.isActive()
                || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body("아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
        RefreshToken rt = refreshTokenService.create(user.getUsername());
        return ResponseEntity.ok(new LoginResponseDto(token, rt.getToken(), user.getUsername(), user.getRole()));
    }

    @PostMapping("/refresh")
    @Operation(summary = "액세스 토큰 갱신", description = "리프레시 토큰으로 새 액세스 토큰 + 새 리프레시 토큰 발급 (rotation)")
    public ResponseEntity<?> refresh(@RequestBody RefreshRequestDto request) {
        return refreshTokenService.validate(request.getRefreshToken())
                .map(rt -> {
                    User user = userRepository.findByUsername(rt.getUsername()).orElse(null);
                    if (user == null || !user.isActive()) {
                        refreshTokenService.revoke(request.getRefreshToken());
                        return ResponseEntity.status(401).<Object>body("사용자를 찾을 수 없습니다.");
                    }
                    // Rotation: 기존 토큰 무효화 후 새 토큰 발급
                    refreshTokenService.revoke(request.getRefreshToken());
                    RefreshToken newRt = refreshTokenService.create(user.getUsername());
                    String newToken = jwtUtil.generateToken(user.getUsername(), user.getRole());
                    return ResponseEntity.ok((Object) Map.of("token", newToken, "refreshToken", newRt.getToken()));
                })
                .orElse(ResponseEntity.status(401).body("유효하지 않은 리프레시 토큰입니다."));
    }

    @PostMapping("/logout")
    @Operation(summary = "로그아웃", description = "리프레시 토큰 무효화")
    public ResponseEntity<Void> logout(@RequestBody RefreshRequestDto request) {
        refreshTokenService.revoke(request.getRefreshToken());
        return ResponseEntity.ok().build();
    }
}
