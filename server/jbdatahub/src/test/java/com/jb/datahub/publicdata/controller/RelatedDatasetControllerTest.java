package com.jb.datahub.publicdata.controller;

import com.jb.datahub.auth.JwtUtil;
import com.jb.datahub.auth.TokenBlacklist;
import com.jb.datahub.auth.UserTokenRevocationStore;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.config.SecurityConfig;
import com.jb.datahub.publicdata.dto.RelatedDatasetDto;
import com.jb.datahub.publicdata.service.RelatedDatasetService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RelatedDatasetController.class)
@Import(SecurityConfig.class)
class RelatedDatasetControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean RelatedDatasetService relatedDatasetService;
    @MockBean JwtUtil jwtUtil;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean UserRepository userRepository;

    // ── GET /api/public-data/related ─────────────────────────────────────────

    @Test
    @DisplayName("GET /api/public-data/related?q=날씨 — 연관 데이터셋 반환")
    void related_returns200() throws Exception {
        RelatedDatasetDto dto = RelatedDatasetDto.builder()
                .listId("15000001")
                .listTitle("기상청 날씨 API")
                .orgNm("기상청")
                .score(0.85)
                .build();
        when(relatedDatasetService.related(anyString(), anyInt())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/public-data/related?q=날씨"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].listId").value("15000001"))
                .andExpect(jsonPath("$[0].orgNm").value("기상청"));
    }

    @Test
    @DisplayName("GET /api/public-data/related — q 없으면 400 (required param)")
    void related_missingQ_returns400() throws Exception {
        mockMvc.perform(get("/api/public-data/related"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/public-data/related?q= — 빈 q는 빈 배열 반환")
    void related_blankQ_returnsEmpty() throws Exception {
        mockMvc.perform(get("/api/public-data/related?q="))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    @DisplayName("GET /api/public-data/related?q=test&limit=30 — limit은 20으로 클램핑")
    void related_limitClamp() throws Exception {
        when(relatedDatasetService.related(anyString(), eq(20))).thenReturn(List.of());

        mockMvc.perform(get("/api/public-data/related?q=test&limit=30"))
                .andExpect(status().isOk());
    }
}
