package com.jb.datahub.auth;

import com.jb.datahub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.jb.datahub.auth.entity.User;
import java.util.List;

/**
 * 앱 기동 시 DB에 평문으로 남아있는 serviceKey를 AES-GCM으로 일괄 암호화.
 * - 기본(dev) 암호화 키 사용 중이면 실행하지 않음 (데이터 손실 방지)
 * - 대상 행만 조건부 쿼리로 로드 후 JdbcTemplate batchUpdate로 처리
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class ServiceKeyMigration {

    private final UserRepository userRepository;
    private final ServiceKeyEncryptor serviceKeyEncryptor;
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner migrateServiceKeys() {
        return args -> runMigration();
    }

    @Transactional
    public void runMigration() {
        // prod에 배포됐지만 SERVICE_KEY_ENCRYPTION_SECRET 미설정 시 기본 키로 암호화되어 데이터 손실 방지
        if (serviceKeyEncryptor.isUsingDefaultSecret()) {
            log.warn("ServiceKeyMigration: 개발용 기본 암호화 키 감지 — 마이그레이션 건너뜀 (prod에선 SERVICE_KEY_ENCRYPTION_SECRET 환경변수 설정 필수)");
            return;
        }

        List<User> targets = userRepository.findUsersWithPlaintextServiceKey();
        if (targets.isEmpty()) return;

        jdbcTemplate.batchUpdate(
                "UPDATE users SET service_key = ? WHERE id = ?",
                targets, targets.size(),
                (ps, u) -> {
                    ps.setString(1, serviceKeyEncryptor.encrypt(u.getServiceKey()));
                    ps.setLong(2, u.getId());
                });
        log.info("ServiceKey 마이그레이션 완료: {}건 암호화", targets.size());
    }
}
