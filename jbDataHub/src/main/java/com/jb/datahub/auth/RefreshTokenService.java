package com.jb.datahub.auth;

import com.jb.datahub.auth.entity.RefreshToken;
import com.jb.datahub.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository repository;

    @Transactional
    public RefreshToken create(String username) {
        repository.deleteUsedByUsername(username);
        return repository.save(RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .username(username)
                .expiresAt(LocalDateTime.now().plusDays(30))
                .build());
    }

    /**
     * 유효한 토큰이면 Optional 반환.
     * 이미 사용된 토큰이 제출된 경우 탈취 공격으로 간주하고 해당 사용자의 모든 토큰을 즉시 폐기.
     */
    @Transactional
    public Optional<RefreshToken> validate(String token) {
        return repository.findByToken(token).map(rt -> {
            if (rt.isUsed()) {
                log.warn("Refresh token reuse detected for user: {}", rt.getUsername());
                repository.deleteByUsername(rt.getUsername());
                return Optional.<RefreshToken>empty();
            }
            if (rt.getExpiresAt().isBefore(LocalDateTime.now())) {
                repository.delete(rt);
                return Optional.<RefreshToken>empty();
            }
            return Optional.of(rt);
        }).orElse(Optional.empty());
    }

    @Transactional
    public void revoke(String token) {
        repository.findByToken(token).ifPresent(rt -> {
            rt.setUsed(true);
            repository.save(rt);
        });
    }

    @Transactional
    public void revokeByUsername(String username) {
        repository.deleteByUsername(username);
    }
}
