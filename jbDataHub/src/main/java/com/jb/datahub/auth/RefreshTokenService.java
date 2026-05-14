package com.jb.datahub.auth;

import com.jb.datahub.auth.entity.RefreshToken;
import com.jb.datahub.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository repository;

    @Transactional
    public RefreshToken create(String username) {
        repository.deleteByUsername(username);
        return repository.save(RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .username(username)
                .expiresAt(LocalDateTime.now().plusDays(30))
                .build());
    }

    public Optional<RefreshToken> validate(String token) {
        return repository.findByToken(token)
                .filter(rt -> rt.getExpiresAt().isAfter(LocalDateTime.now()));
    }

    @Transactional
    public void revoke(String token) {
        repository.findByToken(token).ifPresent(repository::delete);
    }

    @Transactional
    public void revokeByUsername(String username) {
        repository.deleteByUsername(username);
    }
}
