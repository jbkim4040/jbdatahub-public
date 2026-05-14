package com.jb.datahub;

import com.jb.datahub.auth.entity.User;
import com.jb.datahub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
@EnableAsync
public class JbDataHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(JbDataHubApplication.class, args);
    }

    /** 최초 실행 시 users 테이블이 비어 있으면 기본 관리자 계정을 생성한다. */
    @Bean
    CommandLineRunner dataInitializer(UserRepository userRepository,
                                      PasswordEncoder passwordEncoder,
                                      Environment env) {
        return args -> {
            if (userRepository.count() == 0) {
                String username = env.getProperty("admin.username", "admin");
                String rawPassword = env.getProperty("admin.password", "admin1234");
                User admin = User.builder()
                        .username(username)
                        .password(passwordEncoder.encode(rawPassword))
                        .role("ADMIN")
                        .build();
                userRepository.save(admin);
                System.out.println("[DataInitializer] 기본 관리자 계정 생성: " + username);
            }
        };
    }
}
