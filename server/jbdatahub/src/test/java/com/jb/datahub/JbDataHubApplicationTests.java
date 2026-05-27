package com.jb.datahub;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Jenkins CI에 DB 연결 없음 — WebMvcTest 슬라이스 테스트가 대신 검증")
class JbDataHubApplicationTests {

    @Test
    void contextLoads() {
    }

}
