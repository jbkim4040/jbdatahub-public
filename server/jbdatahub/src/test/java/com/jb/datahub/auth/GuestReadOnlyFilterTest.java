package com.jb.datahub.auth;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GuestReadOnlyFilterTest {

    @InjectMocks
    private GuestReadOnlyFilter filter;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void setGuestAuth() {
        var auth = new UsernamePasswordAuthenticationToken(
            "visitor", null, List.of(new SimpleGrantedAuthority("ROLE_GUEST")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void setAdminAuth() {
        var auth = new UsernamePasswordAuthenticationToken(
            "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("GUEST — GET /api/admin/** 허용")
    void guest_get_admin_passes() throws Exception {
        setGuestAuth();
        var req = new MockHttpServletRequest("GET", "/api/admin/collect/status");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilterInternal(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull(); // filter chain was called
    }

    @Test
    @DisplayName("GUEST — POST /api/admin/** 차단 → 403")
    void guest_post_admin_blocked() throws Exception {
        setGuestAuth();
        var req = new MockHttpServletRequest("POST", "/api/admin/collect/start");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilterInternal(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(403);
        assertThat(res.getContentAsString()).contains("guest_readonly");
        assertThat(chain.getRequest()).isNull(); // filter chain NOT called
    }

    @Test
    @DisplayName("GUEST — DELETE /api/admin/** 차단 → 403")
    void guest_delete_admin_blocked() throws Exception {
        setGuestAuth();
        var req = new MockHttpServletRequest("DELETE", "/api/admin/users/1");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilterInternal(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(403);
    }

    @Test
    @DisplayName("GUEST — POST /api/auth/login 허용 (예외 경로)")
    void guest_post_login_allowed() throws Exception {
        setGuestAuth();
        var req = new MockHttpServletRequest("POST", "/api/auth/login");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilterInternal(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    @DisplayName("ADMIN — POST /api/admin/** 허용")
    void admin_post_passes() throws Exception {
        setAdminAuth();
        var req = new MockHttpServletRequest("POST", "/api/admin/collect/start");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilterInternal(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    @DisplayName("인증 없음 — 필터 통과 (Security가 별도 차단)")
    void unauthenticated_passes_filter() throws Exception {
        var req = new MockHttpServletRequest("POST", "/api/admin/collect/start");
        var res = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilterInternal(req, res, chain);

        assertThat(chain.getRequest()).isNotNull();
    }
}
