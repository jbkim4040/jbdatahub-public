package com.jb.datahub.publicdata.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jb.datahub.auth.JwtUtil;
import com.jb.datahub.auth.TokenBlacklist;
import com.jb.datahub.auth.UserTokenRevocationStore;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.config.SecurityConfig;
import com.jb.datahub.publicdata.dto.CollectScheduleConfigDto;
import com.jb.datahub.publicdata.entity.CollectScheduleConfig;
import com.jb.datahub.publicdata.service.SchedulerConfigService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SchedulerController.class)
@Import(SecurityConfig.class)
class SchedulerControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean SchedulerConfigService schedulerConfigService;

    private org.springframework.security.core.Authentication adminAuth() {
        return new UsernamePasswordAuthenticationToken(
                "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private CollectScheduleConfig defaultConfig() {
        return CollectScheduleConfig.builder()
                .id("default")
                .enabled(true)
                .scheduleType("DAILY")
                .hour(3)
                .minute(0)
                .build();
    }

    // ── GET /api/admin/scheduler ──────────────────────────────────────────────

    @Test
    @DisplayName("GET /api/admin/scheduler — ADMIN 인증 시 스케줄 반환")
    void getScheduler_admin_returns200() throws Exception {
        when(schedulerConfigService.getOrDefault()).thenReturn(defaultConfig());

        mockMvc.perform(get("/api/admin/scheduler")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scheduleType").value("DAILY"))
                .andExpect(jsonPath("$.hour").value(3));
    }

    @Test
    @DisplayName("GET /api/admin/scheduler — 미인증 시 401")
    void getScheduler_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/admin/scheduler"))
                .andExpect(status().isUnauthorized());
    }

    // ── PUT /api/admin/scheduler ──────────────────────────────────────────────

    @Test
    @DisplayName("PUT /api/admin/scheduler — 스케줄 설정 업데이트 성공")
    void updateScheduler_admin_returns200() throws Exception {
        CollectScheduleConfig updated = CollectScheduleConfig.builder()
                .id("default")
                .enabled(false)
                .scheduleType("HOURLY")
                .intervalHours(6)
                .build();
        when(schedulerConfigService.update(any(CollectScheduleConfigDto.class))).thenReturn(updated);

        Map<String, Object> body = Map.of("enabled", false, "scheduleType", "HOURLY", "intervalHours", 6);
        mockMvc.perform(put("/api/admin/scheduler")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scheduleType").value("HOURLY"))
                .andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    @DisplayName("PUT /api/admin/scheduler — 미인증 시 401")
    void updateScheduler_unauthenticated_returns401() throws Exception {
        mockMvc.perform(put("/api/admin/scheduler")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("enabled", true))))
                .andExpect(status().isUnauthorized());
    }
}
