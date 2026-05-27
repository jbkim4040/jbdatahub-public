package com.jb.datahub.config;

import com.jb.datahub.auth.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestMdcFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String traceId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        MDC.put("traceId", traceId);
        MDC.put("method", request.getMethod());
        MDC.put("path", request.getRequestURI());
        response.setHeader("X-Request-ID", traceId);

        String userId = "GUEST";
        String userRole = "GUEST";
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if ("jb_token".equals(c.getName())) {
                    try {
                        String token = c.getValue();
                        if (jwtUtil.isValid(token)) {
                            userId = jwtUtil.getUsername(token);
                            userRole = jwtUtil.getRole(token);
                        }
                    } catch (Exception ignored) {}
                    break;
                }
            }
        }
        MDC.put("userId", userId);
        MDC.put("userRole", userRole);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
