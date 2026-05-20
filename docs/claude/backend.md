## 백엔드 핵심 기술
- **DB**: Supabase PostgreSQL (pgBouncer 커넥션 풀, Transaction 모드)
- **캐시**: Caffeine (spring-boot-starter-cache 필수) — `stats` 캐시 10분 TTL
- **배치 저장**: JdbcTemplate `ON CONFLICT DO UPDATE` (JPA saveAll 대비 ~4× 빠름)
- **병렬 수집**: `CompletableFuture.supplyAsync` 3-페이지 동시 fetch
- **JWT**: JJWT 0.12.x — Access Token 15분, Refresh Token 7일
- **권한**: SUPER_ADMIN > ADMIN > USER 계층 (Spring Security hasAnyRole)

## 중요 설정 패턴
```yaml
# application.yml
spring:
  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=200,expireAfterWrite=10m
  jpa:
    hibernate:
      ddl-auto: validate  # update 아님 — 느린 시작 방지
    properties:
      hibernate:
        jdbc:
          batch_size: 100
```

## 주요 주의사항
- `@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")` 사용 — `hasRole('ADMIN')` 단독 사용 시 SUPER_ADMIN 차단됨
- JdbcTemplate batchUpdate는 `@Transactional` 필요
- `@CacheEvict(value = "stats", allEntries = true)` — 데이터 저장 후 stats 캐시 무효화
- `PublicApiList.@ToString(exclude = "operations")` — 순환 참조 방지 필수
- SCP로 파일 전송 후 커밋 (SSH heredoc 사용 시 따옴표 이스케이프 버그 발생)
- Java 소스 내 `replaceAll` 정규식 이스케이프 주의: `"^\"|\\"$"` → `"^\"|\"$"` 형태로 작성
