package com.jb.datahub.auth;

import com.jb.datahub.auth.dto.LoginRequestDto;
import com.jb.datahub.auth.dto.LoginResponseDto;
import com.jb.datahub.auth.dto.RefreshRequestDto;
import com.jb.datahub.auth.entity.RefreshToken;
import com.jb.datahub.auth.entity.User;
import com.jb.datahub.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "인증 API", description = "로그인 / 토큰 갱신 / 로그아웃 (httpOnly cookie 사용)")
public class AuthController {

    private static final String TOKEN_COOKIE = "jb_token";
    private static final String REFRESH_COOKIE = "jb_refresh";
    private static final int    TOKEN_MAX_AGE   = 60 * 60;           // 1시간
    private static final int    REFRESH_MAX_AGE = 7 * 24 * 60 * 60;   // 7일

    private final JwtUtil              jwtUtil;
    private final UserRepository       userRepository;
    private final PasswordEncoder      passwordEncoder;
    private final RefreshTokenService  refreshTokenService;
    private final TokenBlacklist     tokenBlacklist;

    @PostMapping("/login")
    @Operation(summary = "로그인")
    /** dummy BCrypt — timing leak 차단용 (실제로 매칭되지 않음) */
    private static final String DUMMY_BCRYPT = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    public ResponseEntity<?> login(@Valid @RequestBody LoginRequestDto request) {
        User user = userRepository.findByUsername(request.getUsername()).orElse(null);
        if (user == null || !user.isActive()) {
            // 사용자 없음/비활성 — BCrypt 연산 수행하여 응답 시간을 정상 매칭과 동일하게 (CWE-204 차단)
            passwordEncoder.matches(request.getPassword(), DUMMY_BCRYPT);
            return ResponseEntity.status(401).body("아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body("아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        user.setLastLoginAt(java.time.LocalDateTime.now());
        userRepository.save(user);
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
        RefreshToken rt = refreshTokenService.create(user.getUsername());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, authCookie(TOKEN_COOKIE, token, TOKEN_MAX_AGE, "/").toString())
                .header(HttpHeaders.SET_COOKIE, authCookie(REFRESH_COOKIE, rt.getToken(), REFRESH_MAX_AGE, "/api/auth").toString())
                .body(new LoginResponseDto(user.getUsername(), user.getRole()));
    }

    @PostMapping("/refresh")
    @Operation(summary = "액세스 토큰 갱신")
    public ResponseEntity<?> refresh(@RequestBody(required = false) RefreshRequestDto request,
                                     HttpServletRequest httpReq) {
        String refreshToken = extractRefreshToken(request, httpReq);
        if (refreshToken == null) {
            return ResponseEntity.status(401).body("리프레시 토큰이 없습니다.");
        }
        return refreshTokenService.validate(refreshToken)
                .map(rt -> {
                    User user = userRepository.findByUsername(rt.getUsername()).orElse(null);
                    if (user == null || !user.isActive()) {
                        refreshTokenService.revoke(refreshToken);
                        return ResponseEntity.status(401).<Object>body("사용자를 찾을 수 없습니다.");
                    }
                    refreshTokenService.revoke(refreshToken);
                    RefreshToken newRt = refreshTokenService.create(user.getUsername());
                    String newToken = jwtUtil.generateToken(user.getUsername(), user.getRole());
                    return ResponseEntity.ok()
                            .header(HttpHeaders.SET_COOKIE, authCookie(TOKEN_COOKIE, newToken, TOKEN_MAX_AGE, "/").toString())
                            .header(HttpHeaders.SET_COOKIE, authCookie(REFRESH_COOKIE, newRt.getToken(), REFRESH_MAX_AGE, "/api/auth").toString())
                            .body((Object) Map.of("ok", true));
                })
                .orElse(ResponseEntity.status(401).body("유효하지 않은 리프레시 토큰입니다."));
    }


    @GetMapping("/me")
    public ResponseEntity<?> me() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return ResponseEntity.status(401).body(java.util.Map.of("error", "unauthenticated"));
        }
        String role = auth.getAuthorities().stream()
                .map(Object::toString)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring(5))
                .findFirst().orElse("USER");
        return ResponseEntity.ok(java.util.Map.of("username", auth.getName(), "role", role));
    }

    @PostMapping("/logout")
    @Operation(summary = "로그아웃 (cookie 제거 + refresh token 무효화 + access token blacklist)")
    public ResponseEntity<Void> logout(@RequestBody(required = false) RefreshRequestDto request,
                                       HttpServletRequest httpReq) {
        // Access token blacklist 등록 — 만료(1시간)까지 즉시 무효화
        String accessToken = extractAccessToken(httpReq);
        if (accessToken != null && jwtUtil.isValid(accessToken)) {
            try {
                java.time.Instant exp = jwtUtil.getExpiration(accessToken).toInstant();
                tokenBlacklist.add(accessToken, exp);
            } catch (Exception ignore) { /* 만료 등 — 어차피 무효 */ }
        }
        String refreshToken = extractRefreshToken(request, httpReq);
        if (refreshToken != null) refreshTokenService.revoke(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expireCookie(TOKEN_COOKIE, "/").toString())
                .header(HttpHeaders.SET_COOKIE, expireCookie(REFRESH_COOKIE, "/api/auth").toString())
                .build();
    }

    /** Cookie 또는 Authorization 헤더에서 access token 추출 (JwtFilter와 동일 규칙) */
    private String extractAccessToken(HttpServletRequest req) {
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if (TOKEN_COOKIE.equals(c.getName())) return c.getValue();
            }
        }
        String h = req.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ")) return h.substring(7);
        return null;
    }

    /** body의 refreshToken 우선, 없으면 cookie에서 추출 */
    private String extractRefreshToken(RefreshRequestDto body, HttpServletRequest req) {
        if (body != null && body.getRefreshToken() != null && !body.getRefreshToken().isBlank()) {
            return body.getRefreshToken();
        }
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if (REFRESH_COOKIE.equals(c.getName())) return c.getValue();
            }
        }
        return null;
    }

    private ResponseCookie authCookie(String name, String value, int maxAge, String path) {
        return ResponseCookie.from(name, value)
                .domain(".jbdatahub.com")  // 서브도메인 공유 (admin.jbdatahub.com)
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path(path)
                .maxAge(maxAge)
                .build();
    }

    private ResponseCookie expireCookie(String name, String path) {
        return ResponseCookie.from(name, "")
                .domain(".jbdatahub.com")
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path(path)
                .maxAge(0)
                .build();
    }
}

