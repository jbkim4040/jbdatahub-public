package com.jb.datahub.publicdata.controller;

import com.jb.datahub.auth.JwtUtil;
import com.jb.datahub.auth.TokenBlacklist;
import com.jb.datahub.auth.UserTokenRevocationStore;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.config.SecurityConfig;
import com.jb.datahub.publicdata.service.SubscribeService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SubscribeController.class)
@Import(SecurityConfig.class)
class SubscribeControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean SubscribeService subscribeService;

    private org.springframework.security.core.Authentication userAuth() {
        return new UsernamePasswordAuthenticationToken(
                "testUser", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    // ── POST /api/public-data/{listId}/subscribe ──────────────────────────────

    @Test
    @DisplayName("POST /api/public-data/15000001/subscribe — 인증 사용자 신청 성공")
    void subscribe_authenticated_returns200() throws Exception {
        Map<String, Object> result = Map.of("status", "requested", "listId", "15000001");
        when(subscribeService.requestSubscription(eq("15000001"), any(), anyString()))
                .thenReturn(result);

        mockMvc.perform(post("/api/public-data/15000001/subscribe")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("requested"));
    }

    @Test
    @DisplayName("POST /api/public-data/15000001/subscribe — 미인증 시 401")
    void subscribe_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/public-data/15000001/subscribe"))
                .andExpect(status().isUnauthorized());
    }

    // ── POST /api/public-data/{listId}/subscribe/manual ──────────────────────

    @Test
    @DisplayName("POST /api/public-data/15000001/subscribe/manual — 수동 신청 마킹 성공")
    void markManual_authenticated_returns200() throws Exception {
        Map<String, Object> result = Map.of("status", "active", "listId", "15000001");
        when(subscribeService.markManual(eq("15000001"), anyString())).thenReturn(result);

        mockMvc.perform(post("/api/public-data/15000001/subscribe/manual")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"));
    }

    @Test
    @DisplayName("POST /api/public-data/15000001/subscribe/manual — 미인증 시 401")
    void markManual_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/public-data/15000001/subscribe/manual"))
                .andExpect(status().isUnauthorized());
    }

    // ── GET /api/public-data/my-subscriptions ────────────────────────────────

    @Test
    @DisplayName("GET /api/public-data/my-subscriptions — 신청 목록 반환")
    void mySubscriptions_authenticated_returns200() throws Exception {
        Map<String, Object> result = Map.of("items", List.of("15000001", "15000002"));
        when(subscribeService.getUserSubscribedIds(anyString())).thenReturn(result);

        mockMvc.perform(get("/api/public-data/my-subscriptions")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(userAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    @DisplayName("GET /api/public-data/my-subscriptions — 미인증 시 401")
    void mySubscriptions_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/public-data/my-subscriptions"))
                .andExpect(status().isUnauthorized());
    }
}
