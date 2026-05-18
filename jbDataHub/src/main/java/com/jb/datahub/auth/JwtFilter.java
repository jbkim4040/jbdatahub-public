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

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && jwtUtil.isValid(token) && !tokenBlacklist.isBlacklisted(token)) {
            String username = jwtUtil.getUsername(token);
            String role     = jwtUtil.getRole(token);
            Instant issuedAt = jwtUtil.getIssuedAt(token);

            boolean userActive = userRepository.findByUsername(username)
                    .map(u -> u.isActive()).orElse(false);

            if (userActive && !userTokenRevocationStore.isRevoked(username, issuedAt)) {
                var auth = new UsernamePasswordAuthenticationToken(
                        username, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
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
