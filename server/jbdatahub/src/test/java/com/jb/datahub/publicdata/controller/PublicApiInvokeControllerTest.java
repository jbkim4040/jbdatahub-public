package com.jb.datahub.publicdata.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jb.datahub.auth.JwtUtil;
import com.jb.datahub.auth.TokenBlacklist;
import com.jb.datahub.auth.UserTokenRevocationStore;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.config.SecurityConfig;
import com.jb.datahub.publicdata.dto.InvokeResultDto;
import com.jb.datahub.publicdata.service.PublicApiInvokeService;
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
import org.springframework.test.web.servlet.MvcResult;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PublicApiInvokeController.class)
@Import(SecurityConfig.class)
class PublicApiInvokeControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean PublicApiInvokeService publicApiInvokeService;

    private org.springframework.security.core.Authentication userAuth() {
        return new UsernamePasswordAuthenticationToken(
                "user", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private Map<String, Object> invokeBody(Long operationSeq) {
        return Map.of("operationSeq", operationSeq, "serviceKey", "testKey123", "params", Map.of());
    }

    // ── POST /api/public-data/invoke ──────────────────────────────────────────

    @Test
    @DisplayName("POST /api/public-data/invoke — 호출 성공 시 200")
    void invoke_success() throws Exception {
        InvokeResultDto result = InvokeResultDto.success(200, "application/json", "{\"data\":1}", 100L, "https://apis.data.go.kr/test");
        when(publicApiInvokeService.invoke(any())).thenReturn(Mono.just(result));

        MvcResult mvcResult = mockMvc.perform(post("/api/public-data/invoke")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invokeBody(1L))))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(mvcResult))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.httpStatus").value(200));
    }

    @Test
    @DisplayName("POST /api/public-data/invoke — 호출 실패 시 400")
    void invoke_fail_returns400() throws Exception {
        InvokeResultDto result = InvokeResultDto.fail("SSRF 차단: 허용되지 않는 도메인");
        when(publicApiInvokeService.invoke(any())).thenReturn(Mono.just(result));

        MvcResult mvcResult = mockMvc.perform(post("/api/public-data/invoke")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(userAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invokeBody(1L))))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(mvcResult))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("fail"));
    }

    @Test
    @DisplayName("POST /api/public-data/invoke — 미인증 시 401")
    void invoke_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/public-data/invoke")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invokeBody(1L))))
                .andExpect(status().isUnauthorized());
    }
}
