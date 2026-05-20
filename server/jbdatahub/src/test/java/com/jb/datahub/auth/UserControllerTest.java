package com.jb.datahub.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jb.datahub.auth.dto.UserCreateDto;
import com.jb.datahub.auth.dto.UserResponseDto;
import com.jb.datahub.auth.dto.UserUpdateDto;
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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@Import(SecurityConfig.class)
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;
    @MockBean UserService userService;

    private UserResponseDto sampleDto;

    @BeforeEach
    void setUp() {
        User u = User.builder().id(1L).username("user1").role("USER").build();
        sampleDto = new UserResponseDto(u);
    }

    private org.springframework.security.core.Authentication adminAuth() {
        return new UsernamePasswordAuthenticationToken(
                "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    // ── GET /api/admin/users ──────────────────────────────────────────────────

    @Test
    @DisplayName("GET /api/admin/users — ADMIN 인증 시 목록 반환")
    void list_admin_returns200() throws Exception {
        when(userService.findAll()).thenReturn(List.of(sampleDto));

        mockMvc.perform(get("/api/admin/users")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].username").value("user1"));
    }

    @Test
    @DisplayName("GET /api/admin/users — 미인증 시 401")
    void list_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isUnauthorized());
    }

    // ── POST /api/admin/users ─────────────────────────────────────────────────

    @Test
    @DisplayName("POST /api/admin/users — 사용자 생성 성공")
    void create_admin_returns200() throws Exception {
        when(userService.create(any(), anyString())).thenReturn(sampleDto);

        Map<String, String> body = Map.of("username", "user1", "password", "password1", "role", "USER");
        mockMvc.perform(post("/api/admin/users")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("user1"));
    }

    @Test
    @DisplayName("POST /api/admin/users — username 2자 이하 시 400")
    void create_shortUsername_returns400() throws Exception {
        Map<String, String> body = Map.of("username", "ab", "password", "password1");
        mockMvc.perform(post("/api/admin/users")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/admin/users — 미인증 시 401")
    void create_unauthenticated_returns401() throws Exception {
        Map<String, String> body = Map.of("username", "user1", "password", "password1");
        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    // ── PUT /api/admin/users/{id} ─────────────────────────────────────────────

    @Test
    @DisplayName("PUT /api/admin/users/1 — 역할 변경 성공")
    void update_admin_returns200() throws Exception {
        when(userService.update(eq(1L), any(UserUpdateDto.class), anyString(), anyString()))
                .thenReturn(sampleDto);

        mockMvc.perform(put("/api/admin/users/1")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "ADMIN"))))
                .andExpect(status().isOk());
    }

    // ── PUT /api/admin/users/{id}/password ────────────────────────────────────

    @Test
    @DisplayName("PUT /api/admin/users/1/password — 비밀번호 변경 성공")
    void changePassword_admin_returns200() throws Exception {
        doNothing().when(userService).changePassword(eq(1L), any(), anyString());

        mockMvc.perform(put("/api/admin/users/1/password")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("newPassword", "newPass12"))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PUT /api/admin/users/1/password — 8자 미만 시 400")
    void changePassword_tooShort_returns400() throws Exception {
        mockMvc.perform(put("/api/admin/users/1/password")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("newPassword", "short"))))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/admin/users/{id}/revoke-tokens ──────────────────────────────

    @Test
    @DisplayName("POST /api/admin/users/1/revoke-tokens — 토큰 무효화 성공")
    void revokeTokens_admin_returns200() throws Exception {
        doNothing().when(userService).revokeTokens(eq(1L), anyString(), anyString());

        mockMvc.perform(post("/api/admin/users/1/revoke-tokens")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk());
    }

    // ── DELETE /api/admin/users/{id} ──────────────────────────────────────────

    @Test
    @DisplayName("DELETE /api/admin/users/1 — 삭제 성공")
    void delete_admin_returns200() throws Exception {
        doNothing().when(userService).delete(eq(1L), anyString(), anyString());

        mockMvc.perform(delete("/api/admin/users/1")
                        .with(SecurityMockMvcRequestPostProcessors.authentication(adminAuth())))
                .andExpect(status().isOk());
    }
}
