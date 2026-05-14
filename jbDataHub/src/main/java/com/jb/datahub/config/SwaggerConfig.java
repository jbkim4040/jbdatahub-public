package com.jb.datahub.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("jbDataHub API")
                        .description("공공데이터포털 OpenAPI 목록 수집·조회 서비스\n\n" +
                                "**수집 API**는 관리자 JWT 토큰이 필요합니다.\n" +
                                "`POST /api/auth/login` 으로 토큰 발급 후 Authorize 버튼에 입력하세요.")
                        .version("v1.0.0"))
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("로컬"),
                        new Server().url("https://your-domain.com").description("운영")
                ))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth",
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("JWT 토큰을 입력하세요 (Bearer 제외)")
                        )
                );
    }
}
