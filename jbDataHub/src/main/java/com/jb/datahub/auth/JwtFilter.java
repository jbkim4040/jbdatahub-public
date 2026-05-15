package com.jb.datahub.auth;

import com.jb.datahub.auth.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil        jwtUtil;
    private final TokenBlacklist tokenBlacklist;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader(Authorization);

        if (header != null && header.startsWith(Bearer )) {
            String token = header.substring(7);

            if (jwtUtil.isValid(token) && !tokenBlacklist.isBlacklisted(token)) {
                String username = jwtUtil.getUsername(token);
                String role     = jwtUtil.getRole(token);

                // 계정 삭제·비활성화 즉시 반영
                boolean userActive = userRepository.findByUsername(username)
                        .map(u -> u.isActive())
                        .orElse(false);

                if (userActive) {
                    var auth = new UsernamePasswordAuthenticationToken(
                            username,
                            null,
                            List.of(new SimpleGrantedAuthority(ROLE_ + role))
                    );
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
