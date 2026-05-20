package com.jb.datahub.publicdata.controller;

import com.jb.datahub.auth.JwtUtil;
import com.jb.datahub.auth.TokenBlacklist;
import com.jb.datahub.auth.UserTokenRevocationStore;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.config.SecurityConfig;
import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicApiListDto;
import com.jb.datahub.publicdata.dto.SimilarApiDto;
import com.jb.datahub.publicdata.dto.TopicDto;
import com.jb.datahub.publicdata.service.SemanticSearchService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SemanticSearchController.class)
@Import(SecurityConfig.class)
class SemanticSearchControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean SemanticSearchService semanticSearchService;
    @MockBean JwtUtil jwtUtil;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean UserRepository userRepository;

    private PageResponseDto<PublicApiListDto> emptyPage() {
        return PageResponseDto.<PublicApiListDto>builder()
                .content(List.of()).totalElements(0).page(0).size(20).totalPages(0)
                .first(true).last(true).build();
    }

    // ── GET /api/public-data/semantic ─────────────────────────────────────────

    @Test
    @DisplayName("GET /api/public-data/semantic?q=날씨 — 인증 없이 200")
    void semanticSearch_returns200() throws Exception {
        when(semanticSearchService.semanticSearch(anyString(), anyInt(), anyInt())).thenReturn(emptyPage());

        mockMvc.perform(get("/api/public-data/semantic?q=날씨"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @DisplayName("GET /api/public-data/semantic — size 200 요청 시 100으로 클램핑")
    void semanticSearch_sizeClamp() throws Exception {
        when(semanticSearchService.semanticSearch(anyString(), eq(0), eq(100))).thenReturn(emptyPage());

        mockMvc.perform(get("/api/public-data/semantic?q=test&size=200"))
                .andExpect(status().isOk());
    }

    // ── GET /api/public-data/{listId}/similar ─────────────────────────────────

    @Test
    @DisplayName("GET /api/public-data/15000001/similar — 유사 API 목록 반환")
    void getSimilar_returns200() throws Exception {
        SimilarApiDto similar = SimilarApiDto.builder()
                .listId("15000002").listTitle("유사 API").build();
        when(semanticSearchService.getSimilar("15000001")).thenReturn(List.of(similar));

        mockMvc.perform(get("/api/public-data/15000001/similar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].listId").value("15000002"));
    }

    // ── GET /api/public-data/related-terms ───────────────────────────────────

    @Test
    @DisplayName("GET /api/public-data/related-terms?q=날씨 — 관련 검색어 반환")
    void relatedTerms_returns200() throws Exception {
        List<Map<String, Object>> terms = List.of(Map.of("term", "기상", "score", 0.9));
        when(semanticSearchService.getRelatedTerms(anyString(), anyInt())).thenReturn(terms);

        mockMvc.perform(get("/api/public-data/related-terms?q=날씨"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].term").value("기상"));
    }

    @Test
    @DisplayName("GET /api/public-data/related-terms — limit 100 요청 시 20으로 클램핑")
    void relatedTerms_limitClamp() throws Exception {
        when(semanticSearchService.getRelatedTerms(anyString(), eq(20))).thenReturn(List.of());

        mockMvc.perform(get("/api/public-data/related-terms?q=test&limit=100"))
                .andExpect(status().isOk());
    }

    // ── GET /api/public-data/embed-progress ──────────────────────────────────

    @Test
    @DisplayName("GET /api/public-data/embed-progress — 임베딩 진행 상황 반환")
    void embedProgress_returns200() throws Exception {
        Map<String, Object> progress = Map.of("total", 1000, "done", 500, "pct", 50);
        when(semanticSearchService.getEmbedProgress()).thenReturn(progress);

        mockMvc.perform(get("/api/public-data/embed-progress"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1000))
                .andExpect(jsonPath("$.pct").value(50));
    }

    // ── GET /api/public-data/topics ───────────────────────────────────────────

    @Test
    @DisplayName("GET /api/public-data/topics — 토픽 목록 반환")
    void getTopics_returns200() throws Exception {
        TopicDto topic = TopicDto.builder().topicId(1).topicKeywords("날씨,기상,강수").itemCount(42).build();
        when(semanticSearchService.getTopics()).thenReturn(List.of(topic));

        mockMvc.perform(get("/api/public-data/topics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].topicId").value(1))
                .andExpect(jsonPath("$[0].itemCount").value(42));
    }

    // ── GET /api/public-data/topics/{topicId}/list ────────────────────────────

    @Test
    @DisplayName("GET /api/public-data/topics/1/list — 토픽별 목록 반환")
    void getListByTopic_returns200() throws Exception {
        when(semanticSearchService.getListByTopic(anyInt(), anyInt(), anyInt())).thenReturn(emptyPage());

        mockMvc.perform(get("/api/public-data/topics/1/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }
}
