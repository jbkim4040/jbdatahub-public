package com.jb.datahub.auth;

import com.jb.datahub.auth.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final TokenBlacklist tokenBlacklist;
    private final UserTokenRevocationStore userTokenRevocationStore;
    private final UserRepository userRepository;

    @Value("${jwt.expiration:900000}")
    private long jwtExpirationMs;

    /** 잔여 시간이 이 값보다 작으면 새 토큰 발급 (sliding window) — TTL의 1/3 */
    private static final long SLIDING_THRESHOLD_MS = 5 * 60 * 1000L;   // 5분

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && jwtUtil.isValid(token) && !tokenBlacklist.isBlacklisted(token)) {
            String username = jwtUtil.getUsername(token);
            String role     = jwtUtil.getRole(token);
            Instant issuedAt = jwtUtil.getIssuedAt(token);

            var userOpt = userRepository.findByUsername(username);
            boolean userActive = userOpt.map(u -> u.isActive()).orElse(false);
            // Blue/Green 재시작 시 메모리 store 가 초기화되므로 DB tokensRevokedAt 으로 이중 검증 (M3)
            boolean dbRevoked = userOpt.map(u -> {
                java.time.Instant rev = u.getTokensRevokedAt();
                return rev != null && !issuedAt.isAfter(rev);
            }).orElse(false);

            if (userActive && !dbRevoked && !userTokenRevocationStore.isRevoked(username, issuedAt)) {
                var auth = new UsernamePasswordAuthenticationToken(
                        username, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);

                // === Sliding token: 잔여 시간 < 30분이면 새 토큰 발급 ===
                try {
                    long remaining = jwtUtil.getExpiration(token).getTime() - System.currentTimeMillis();
                    if (remaining < SLIDING_THRESHOLD_MS) {
                        String newToken = jwtUtil.generateToken(username, role);
                        ResponseCookie cookie = ResponseCookie.from("jb_token", newToken)
                                .domain(".jbdatahub.com")
                                .httpOnly(true).secure(true).sameSite("Lax")
                                .path("/").maxAge(jwtExpirationMs / 1000).build();
                        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
                    }
                } catch (Exception ignore) {}
            }
        }
        filterChain.doFilter(request, response);
    }

    /** httpOnly cookie 우선, 없으면 Authorization 헤더 fallback */
    private String extractToken(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if ("jb_token".equals(c.getName())) {
                    return c.getValue();
                }
            }
        }
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
