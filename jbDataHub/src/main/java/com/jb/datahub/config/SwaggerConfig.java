package com.jb.datahub.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class SwaggerConfig {

    @Value("${spring.application.name:jbDataHub}")
    private String appName;

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(apiInfo())
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("로컬 개발 서버"),
                        new Server().url("https://your-prod-domain.com").description("운영 서버")
                ))
                .components(new Components());
    }

    private Info apiInfo() {
        return new Info()
                .title("jbDataHub API")
                .description("공공데이터포털(data.go.kr) OpenAPI 목록 수집 및 조회 서비스")
                .version("v1.0.0")
                .contact(new Contact()
                        .name("jbDataHub")
                        .email("admin@jbdatahub.com"))
                .license(new License()
                        .name("Apache 2.0")
                        .url("https://www.apache.org/licenses/LICENSE-2.0"));
    }
}
