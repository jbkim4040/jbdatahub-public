package com.jb.datahub.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jb.datahub.auth.entity.Role;
import com.jb.datahub.auth.entity.User;
import com.jb.datahub.auth.repository.UserRepository;
import com.jb.datahub.config.SecurityConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthMeServiceKeyTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean PasswordEncoder passwordEncoder;
    @MockBean RefreshTokenService refreshTokenService;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean ServiceKeyEncryptor serviceKeyEncryptor;

    private static final String USERNAME = "admin";
    private static final String SERVICE_KEY = "testServiceKey123";

    private User adminUser;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .username(USERNAME)
                .password("encodedPwd")
                .role(Role.ADMIN)
                .serviceKey(SERVICE_KEY)
                .build();
    }

    private org.springframework.security.core.Authentication adminAuth() {
        return new UsernamePasswordAuthenticationToken(
                USERNAME, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    // ── GET /api/auth/me ──────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /api/auth/me — 인증된 사용자, serviceKey 포함 응답")
    void me_authenticated_returnsServiceKey() throws Exception {
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.of(adminUser));

        mockMvc.perform(get("/api/auth/me")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(USERNAME))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.serviceKey").value(SERVICE_KEY));
    }

    @Test
    @DisplayName("GET /api/auth/me — serviceKey 없는 사용자, 빈 문자열 반환")
    void me_noServiceKey_returnsEmpty() throws Exception {
        User noKey = User.builder().username(USERNAME).password("pwd").role(Role.USER).build();
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.of(noKey));

        mockMvc.perform(get("/api/auth/me")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceKey").value(""));
    }

    @Test
    @DisplayName("GET /api/auth/me — 미인증 시 401")
    void me_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    // ── PATCH /api/auth/me/service-key ────────────────────────────────────────

    @Test
    @DisplayName("PATCH /api/auth/me/service-key — 정상 저장")
    void updateServiceKey_success() throws Exception {
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.of(adminUser));
        when(userRepository.save(any(User.class))).thenReturn(adminUser);

        mockMvc.perform(patch("/api/auth/me/service-key")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("serviceKey", "newKey"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true));

        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    @DisplayName("PATCH /api/auth/me/service-key — 빈 키 전달 시 null로 저장")
    void updateServiceKey_blank_savesNull() throws Exception {
        when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.of(adminUser));
        when(userRepository.save(any(User.class))).thenReturn(adminUser);

        mockMvc.perform(patch("/api/auth/me/service-key")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("serviceKey", ""))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PATCH /api/auth/me/service-key — 1000자 초과 시 400")
    void updateServiceKey_tooLong_returns400() throws Exception {
        String longKey = "a".repeat(1001);

        mockMvc.perform(patch("/api/auth/me/service-key")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("serviceKey", longKey))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PATCH /api/auth/me/service-key — 미인증 시 401")
    void updateServiceKey_unauthenticated_returns401() throws Exception {
        mockMvc.perform(patch("/api/auth/me/service-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("serviceKey", "key"))))
                .andExpect(status().isUnauthorized());
    }

}
