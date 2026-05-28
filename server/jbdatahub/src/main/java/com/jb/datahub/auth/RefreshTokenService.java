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
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build());
    }

    public Optional<RefreshToken> validate(String token) {
        return repository.findByToken(token)
                .filter(rt -> rt.getExpiresAt().isAfter(LocalDateTime.now()));
    }

    /** validate + revoke 를 하나의 트랜잭션에서 원자적으로 처리 (PESSIMISTIC_WRITE 락으로 TOCTOU 완전 차단) */
    @Transactional
    public Optional<RefreshToken> validateAndRevoke(String token) {
        Optional<RefreshToken> found = repository.findByTokenForUpdate(token)
                .filter(rt -> rt.getExpiresAt().isAfter(LocalDateTime.now()));
        found.ifPresent(repository::delete);
        return found;
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
