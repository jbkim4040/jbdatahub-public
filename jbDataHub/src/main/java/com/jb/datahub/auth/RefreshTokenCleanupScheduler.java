package com.jb.datahub.auth;

import com.jb.datahub.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class RefreshTokenCleanupScheduler {

    private final RefreshTokenRepository repository;

    // 매일 새벽 3시에 만료/사용된 토큰 정리
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupExpiredTokens() {
        long deleted = repository.deleteExpiredAndUsed();
        if (deleted > 0) {
            log.info("Cleaned up {} expired/used refresh tokens", deleted);
        }
    }
}
