package com.jb.datahub.config;

import com.jb.datahub.auth.JwtUtil;
import com.jb.datahub.auth.TokenBlacklist;
import com.jb.datahub.auth.UserTokenRevocationStore;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.HealthController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SecurityConfig requestMatchers 검증.
 * actuator/prometheus는 인증 없이 접근 가능해야 한다 (Prometheus 스크래핑).
 * WebMvcTest 컨텍스트에서는 actuator 핸들러가 없어 404가 반환되나,
 * 401/403이 아닌 것이 핵심 — Security가 차단하지 않음을 의미한다.
 */
@WebMvcTest(HealthController.class)
@Import(SecurityConfig.class)
class SecurityConfigTest {

    @Autowired MockMvc mockMvc;

    @MockBean JdbcTemplate jdbcTemplate;
    @MockBean JwtUtil jwtUtil;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean UserRepository userRepository;
    @MockBean com.jb.datahub.auth.GuestReadOnlyFilter guestReadOnlyFilter;

    @Test
    @DisplayName("/actuator/prometheus — 인증 없이 접근 시 401/403 아님")
    void actuator_prometheus_no_auth_not_blocked() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isNotIn(401, 403));
    }

    @Test
    @DisplayName("/api/health — 인증 없이 200")
    void health_no_auth_returns_200() throws Exception {
        org.mockito.Mockito.when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("/api/admin/collect/status — 인증 없이 401")
    void admin_endpoint_requires_auth() throws Exception {
        mockMvc.perform(get("/api/admin/collect/status"))
                .andExpect(status().isUnauthorized());
    }
}
