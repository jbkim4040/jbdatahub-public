package com.jb.datahub.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jb.datahub.auth.entity.RefreshToken;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean PasswordEncoder passwordEncoder;
    @MockBean RefreshTokenService refreshTokenService;
    @MockBean TokenBlacklist tokenBlacklist;
    @MockBean UserTokenRevocationStore userTokenRevocationStore;

    private User activeAdmin;

    @BeforeEach
    void setUp() {
        activeAdmin = User.builder()
                .username("admin")
                .password("$2a$10$encodedPassword")
                .role("ADMIN")
                .build();
    }

    @Test
    @DisplayName("올바른 자격증명으로 로그인 성공")
    void login_success() throws Exception {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(activeAdmin));
        when(passwordEncoder.matches("admin1234", activeAdmin.getPassword())).thenReturn(true);
        when(jwtUtil.generateToken("admin", "ADMIN")).thenReturn("mock-jwt-token");
        RefreshToken rt = RefreshToken.builder()
                .token("mock-refresh-token")
                .username("admin")
                .expiresAt(LocalDateTime.now().plusDays(30))
                .build();
        when(refreshTokenService.create("admin")).thenReturn(rt);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("username", "admin", "password", "admin1234"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock-jwt-token"))
                .andExpect(jsonPath("$.refreshToken").value("mock-refresh-token"))
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    @DisplayName("잘못된 비밀번호로 로그인 실패 — 401 반환")
    void login_wrongPassword_returns401() throws Exception {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(activeAdmin));
        when(passwordEncoder.matches("wrongpass", activeAdmin.getPassword())).thenReturn(false);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("username", "admin", "password", "wrongpass"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("존재하지 않는 사용자 로그인 — 401 반환")
    void login_unknownUser_returns401() throws Exception {
        when(userRepository.findByUsername("nobody")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("username", "nobody", "password", "pass"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비활성화된 계정 로그인 — 401 반환")
    void login_inactiveUser_returns401() throws Exception {
        User inactive = User.builder().username("blocked").password("pw").role("USER")
                .active(false).build();
        when(userRepository.findByUsername("blocked")).thenReturn(Optional.of(inactive));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("username", "blocked", "password", "pw"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("유효한 Refresh Token으로 토큰 갱신 성공")
    void refresh_success() throws Exception {
        RefreshToken rt = RefreshToken.builder()
                .token("valid-refresh")
                .username("admin")
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        when(refreshTokenService.validate("valid-refresh")).thenReturn(Optional.of(rt));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(activeAdmin));
        when(jwtUtil.generateToken("admin", "ADMIN")).thenReturn("new-access-token");
        RefreshToken newRt = RefreshToken.builder().token("new-refresh").username("admin")
                .expiresAt(LocalDateTime.now().plusDays(30)).build();
        when(refreshTokenService.create("admin")).thenReturn(newRt);

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("refreshToken", "valid-refresh"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-access-token"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh"));
    }

    @Test
    @DisplayName("유효하지 않은 Refresh Token — 401 반환")
    void refresh_invalidToken_returns401() throws Exception {
        when(refreshTokenService.validate("invalid")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("refreshToken", "invalid"))))
                .andExpect(status().isUnauthorized());
    }
}
