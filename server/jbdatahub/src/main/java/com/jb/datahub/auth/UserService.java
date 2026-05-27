package com.jb.datahub.auth;

import com.jb.datahub.audit.AuditLogService;
import com.jb.datahub.auth.dto.*;
import com.jb.datahub.auth.entity.Role;
import com.jb.datahub.auth.entity.User;
import com.jb.datahub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository             userRepository;
    private final PasswordEncoder            passwordEncoder;
    private final RefreshTokenService        refreshTokenService;
    private final UserTokenRevocationStore   userTokenRevocationStore;
    private final AuditLogService            auditLogService;

    public List<UserResponseDto> findAll() {
        return userRepository.findAll().stream()
                .map(UserResponseDto::new)
                .toList();
    }

    @Transactional
    public UserResponseDto create(UserCreateDto dto, String requestingRole) {
        if (userRepository.existsByUsername(dto.getUsername())) {
            throw new IllegalArgumentException("이미 존재하는 사용자명입니다: " + dto.getUsername());
        }
        Role role = resolveRole(dto.getRole(), requestingRole);
        User user = User.builder()
                .username(dto.getUsername())
                .password(passwordEncoder.encode(dto.getPassword()))
                .role(role)
                .build();
        UserResponseDto result = new UserResponseDto(userRepository.save(user));
        auditLogService.log("USER_CREATE", dto.getUsername(),
                "created by=" + requestingRole + " role=" + role.name());
        return result;
    }

    @Transactional
    public UserResponseDto update(Long id, UserUpdateDto dto, String requestingRole, String requestingUsername) {
        User user = getUser(id);
        checkCanManage(user.getRole(), requestingRole);

        if (dto.getRole() != null && user.getUsername().equals(requestingUsername)) {
            throw new IllegalArgumentException("자기 자신의 권한은 변경할 수 없습니다.");
        }
        String oldRole = user.getRole().name();
        if (dto.getRole() != null) {
            Role newRole = resolveRole(dto.getRole(), requestingRole);
            user.setRole(newRole);
            if (!oldRole.equals(newRole.name())) {
                auditLogService.log("ROLE_CHANGE", user.getUsername(),
                        "by=" + requestingUsername + " " + oldRole + "->" + newRole.name());
            }
        }
        if (dto.getActive() != null) {
            user.setActive(dto.getActive());
            if (!dto.getActive()) {
                refreshTokenService.revokeByUsername(user.getUsername());
                userTokenRevocationStore.revoke(user.getUsername());
                auditLogService.log("USER_DEACTIVATE", user.getUsername(),
                        "by=" + requestingUsername);
            }
        }
        return new UserResponseDto(user);
    }

    @Transactional
    public void changePassword(Long id, ChangePasswordDto dto, String requestingRole) {
        User user = getUser(id);
        checkCanManage(user.getRole(), requestingRole);
        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        refreshTokenService.revokeByUsername(user.getUsername());
        userTokenRevocationStore.revoke(user.getUsername());
        auditLogService.log("PASSWORD_CHANGE", user.getUsername(),
                "by_role=" + requestingRole);
    }

    @Transactional
    public void delete(Long id, String requestingUsername, String requestingRole) {
        User user = getUser(id);
        if (user.getUsername().equals(requestingUsername)) {
            throw new IllegalArgumentException("자기 자신은 삭제할 수 없습니다.");
        }
        if (user.getRole().name().equals(requestingRole)) {
            throw new IllegalArgumentException("같은 권한(" + requestingRole + ")의 계정은 삭제할 수 없습니다.");
        }
        checkCanManage(user.getRole(), requestingRole);

        auditLogService.log("USER_DELETE", user.getUsername(),
                "by=" + requestingUsername + " role=" + user.getRole().name());
        refreshTokenService.revokeByUsername(user.getUsername());
        user.setTokensRevokedAt(java.time.Instant.now());
        userRepository.save(user);
        userTokenRevocationStore.revoke(user.getUsername());
        userRepository.delete(user);
    }

    @Transactional
    public void revokeTokens(Long id, String requestingUsername, String requestingRole) {
        User user = getUser(id);
        if (user.getUsername().equals(requestingUsername)) {
            throw new IllegalArgumentException("자기 자신에게 강제 로그아웃을 적용할 수 없습니다.");
        }
        if (user.getRole().name().equals(requestingRole)) {
            throw new IllegalArgumentException("같은 권한(" + requestingRole + ")의 계정에 강제 로그아웃을 적용할 수 없습니다.");
        }
        checkCanManage(user.getRole(), requestingRole);
        refreshTokenService.revokeByUsername(user.getUsername());
        user.setTokensRevokedAt(java.time.Instant.now());
        userRepository.save(user);
        userTokenRevocationStore.revoke(user.getUsername());
        auditLogService.log("TOKEN_REVOKE", user.getUsername(),
                "by=" + requestingUsername);
    }

    private User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + id));
    }

    private void checkCanManage(Role targetRole, String requestingRole) {
        if (!"SUPER_ADMIN".equals(requestingRole) &&
                (targetRole == Role.ADMIN || targetRole == Role.SUPER_ADMIN)) {
            throw new IllegalArgumentException("해당 계정을 관리할 권한이 없습니다.");
        }
    }

    private Role resolveRole(String requestedRole, String requestingRole) {
        Role requested;
        try {
            requested = Role.valueOf(requestedRole != null ? requestedRole : "USER");
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("유효하지 않은 역할입니다: " + requestedRole);
        }
        if ("SUPER_ADMIN".equals(requestingRole)) {
            return requested;
        }
        if ("ADMIN".equals(requestingRole)) {
            if (requested == Role.USER || requested == Role.GUEST) return requested;
            throw new IllegalArgumentException("ADMIN은 USER/GUEST 계정만 생성/변경할 수 있습니다.");
        }
        return Role.USER;
    }
}
