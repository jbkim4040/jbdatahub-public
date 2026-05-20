package com.jb.datahub.publicdata.controller;

import com.jb.datahub.auth.JwtUtil;
import com.jb.datahub.auth.TokenBlacklist;
import com.jb.datahub.auth.UserTokenRevocationStore;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.config.SecurityConfig;
import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.dto.CollectStatusDto;
import com.jb.datahub.publicdata.service.CollectionLogService;
import com.jb.datahub.publicdata.service.CollectionStateService;
import com.jb.datahub.publicdata.service.DdlGeneratorService;
import com.jb.datahub.publicdata.service.PublicApiService;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PublicApiCollectController.class)
@Import(SecurityConfig.class)
class PublicApiCollectControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean PublicApiService publicApiService;
    @MockBean CollectionStateService stateService;
    @MockBean CollectionLogService logService;
    @MockBean DdlGeneratorService ddlGeneratorService;

    private org.springframework.security.core.Authentication adminAuth() {
        return new UsernamePasswordAuthenticationToken(
                "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private CollectionStateService.StatusSnapshot idleSnapshot() {
        return new CollectionStateService.StatusSnapshot(
                "IDLE", null, 0, 0, 0, null, 0L, null, Map.of());
    }

    // ── GET /api/admin/collect/status ─────────────────────────────────────────

    @Test
    @DisplayName("GET /api/admin/collect/status — ADMIN 인증 시 200")
    void getStatus_admin_returns200() throws Exception {
        when(stateService.snapshot()).thenReturn(idleSnapshot());

        mockMvc.perform(get("/api/admin/collect/status")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IDLE"));
    }

    @Test
    @DisplayName("GET /api/admin/collect/status — 미인증 시 401")
    void getStatus_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/admin/collect/status"))
                .andExpect(status().isUnauthorized());
    }

    // ── GET /api/admin/collect/history ────────────────────────────────────────

    @Test
    @DisplayName("GET /api/admin/collect/history — 기본 limit 20")
    void getHistory_admin_returns200() throws Exception {
        when(logService.getRecent(20)).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/collect/history")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("GET /api/admin/collect/history?limit=100 — limit은 50으로 클램핑")
    void getHistory_limitClamped() throws Exception {
        when(logService.getRecent(50)).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/collect/history?limit=100")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk());

        verify(logService).getRecent(50);
    }

    // ── POST /api/admin/collect ───────────────────────────────────────────────

    @Test
    @DisplayName("POST /api/admin/collect — 수집 미실행 중이면 202 Accepted")
    void collectAll_notRunning_returns202() throws Exception {
        when(stateService.isRunning()).thenReturn(false);
        doNothing().when(publicApiService).collectAllAsync();

        mockMvc.perform(post("/api/admin/collect")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isAccepted());

        verify(publicApiService).collectAllAsync();
    }

    @Test
    @DisplayName("POST /api/admin/collect — 이미 수집 중이면 409 Conflict")
    void collectAll_alreadyRunning_returns409() throws Exception {
        when(stateService.isRunning()).thenReturn(true);

        mockMvc.perform(post("/api/admin/collect")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isConflict());

        verify(publicApiService, never()).collectAllAsync();
    }

    // ── POST /api/admin/collect/page/{page} ───────────────────────────────────

    @Test
    @DisplayName("POST /api/admin/collect/page/1 — 페이지 수집 성공")
    void collectPage_success() throws Exception {
        CollectResultDto result = CollectResultDto.success(1, 100, 10);
        when(publicApiService.collectPage(1)).thenReturn(result);

        mockMvc.perform(post("/api/admin/collect/page/1")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.page").value(1));
    }

    @Test
    @DisplayName("POST /api/admin/collect/page/1 — 수집 실패 시 400")
    void collectPage_fail_returns400() throws Exception {
        CollectResultDto result = CollectResultDto.fail("외부 API 오류");
        when(publicApiService.collectPage(1)).thenReturn(result);

        mockMvc.perform(post("/api/admin/collect/page/1")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("fail"));
    }

    // ── POST /api/admin/collect/stop ──────────────────────────────────────────

    @Test
    @DisplayName("POST /api/admin/collect/stop — 수집 중지 성공")
    void stopCollect_returns200() throws Exception {
        doNothing().when(publicApiService).stopCollect();

        mockMvc.perform(post("/api/admin/collect/stop")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk());
    }

    // ── POST /api/admin/collect/dataset ───────────────────────────────────────

    @Test
    @DisplayName("POST /api/admin/collect/dataset — 데이터셋 수집 시작")
    void collectDataset_notRunning_returns202() throws Exception {
        when(stateService.isRunning()).thenReturn(false);
        doNothing().when(publicApiService).collectDatasetAsync();

        mockMvc.perform(post("/api/admin/collect/dataset")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isAccepted());
    }

    // ── POST /api/admin/collect/resume ────────────────────────────────────────

    @Test
    @DisplayName("POST /api/admin/collect/resume — 수집 재개")
    void resumeCollect_notRunning_returns202() throws Exception {
        when(stateService.isRunning()).thenReturn(false);
        doNothing().when(publicApiService).resumeAsync();

        mockMvc.perform(post("/api/admin/collect/resume")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isAccepted());
    }

    // ── POST /api/admin/ddl/generate-all ─────────────────────────────────────

    @Test
    @DisplayName("POST /api/admin/ddl/generate-all — 202 Accepted")
    void generateAllDdl_returns202() throws Exception {
        doNothing().when(ddlGeneratorService).generateAndSaveAll();

        mockMvc.perform(post("/api/admin/ddl/generate-all")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isAccepted());
    }
}
