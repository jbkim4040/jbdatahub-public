package com.jb.datahub.publicdata.controller;

import com.jb.datahub.auth.JwtFilter;
import com.jb.datahub.auth.JwtUtil;
import com.jb.datahub.auth.TokenBlacklist;
import com.jb.datahub.auth.UserTokenRevocationStore;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicApiListDto;
import com.jb.datahub.publicdata.dto.StatsDto;
import com.jb.datahub.publicdata.service.PublicApiQueryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PublicApiQueryController.class)
class PublicApiQueryControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean PublicApiQueryService queryService;
    @MockBean JwtUtil jwtUtil;
    @MockBean JwtFilter jwtFilter;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean UserRepository userRepository;

    @Test
    @DisplayName("GET /api/public-data/list — 인증 없이 200 반환")
    void getList_noAuth_returns200() throws Exception {
        PageResponseDto<PublicApiListDto> empty = PageResponseDto.<PublicApiListDto>builder()
                .content(List.of()).totalElements(0).page(0).size(20).totalPages(0)
                .first(true).last(true).build();
        when(queryService.getList(anyInt(), anyInt(), any(), any(), any())).thenReturn(empty);

        mockMvc.perform(get("/api/public-data/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @DisplayName("GET /api/public-data/list?size=200 — size 클램핑 후 200 반환")
    void getList_largeSize_clamped() throws Exception {
        PageResponseDto<PublicApiListDto> empty = PageResponseDto.<PublicApiListDto>builder()
                .content(List.of()).totalElements(0).page(0).size(100).totalPages(0)
                .first(true).last(true).build();
        when(queryService.getList(eq(0), eq(100), isNull(), isNull(), isNull())).thenReturn(empty);

        mockMvc.perform(get("/api/public-data/list?size=200"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET /api/public-data/stats — 200 반환")
    void getStats_returns200() throws Exception {
        StatsDto stats = StatsDto.builder().totalCount(100L).build();
        when(queryService.getStats()).thenReturn(stats);

        mockMvc.perform(get("/api/public-data/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(100));
    }
}
