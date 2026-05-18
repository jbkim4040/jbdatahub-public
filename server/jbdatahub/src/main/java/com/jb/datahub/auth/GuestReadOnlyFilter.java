package com.jb.datahub.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * GUEST role 사용자의 mutation(POST/PUT/PATCH/DELETE)을 차단.
 * GET/HEAD/OPTIONS만 허용 — read-only admin 체험.
 */
@Component
@Order(2)
public class GuestReadOnlyFilter extends OncePerRequestFilter {

    private static final Set<String> READ_ONLY_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private static final Set<String> ALLOWED_MUTATION_PATHS = Set.of(
            "/api/auth/login", "/api/auth/logout", "/api/auth/refresh"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            boolean isGuest = auth.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_GUEST".equals(a.getAuthority()));
            String method = request.getMethod();
            String path = request.getRequestURI();
            if (isGuest && !READ_ONLY_METHODS.contains(method) && !ALLOWED_MUTATION_PATHS.contains(path)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(
                    "{\"error\":\"guest_readonly\",\"message\":\"게스트 계정은 데이터 변경(저장/수정/삭제)을 할 수 없습니다.\"}"
                );
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
