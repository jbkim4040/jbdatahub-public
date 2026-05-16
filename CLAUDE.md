# jb-workspace — 프로젝트 가이드

## 프로젝트 구조
```
jb-workspace/
├── jbDataHub/          # Spring Boot 3.5 백엔드
│   ├── src/main/java/com/jb/datahub/
│   │   ├── auth/           # JWT 인증, 사용자 관리
│   │   ├── config/         # SecurityConfig, CorsConfig
│   │   └── publicdata/     # 공공데이터 수집·조회
│   │       ├── controller/ # REST 엔드포인트
│   │       ├── service/    # 비즈니스 로직
│   │       ├── repository/ # JPA Repository
│   │       └── entity/     # JPA 엔티티
│   └── src/main/resources/
│       ├── application.yml          # 공통 설정
│       └── application-prod.yml     # 운영 환경 설정
└── jbDataHubUI/        # React + Vite 프론트엔드
    └── src/
        ├── api/        # Axios API 호출 (publicApi.js, authApi.js)
        ├── context/    # AuthContext (JWT 토큰 관리)
        └── pages/      # CollectPage, ListPage, SchedulerPage, UsersPage, HomePage
```

## 배포 방식 (Blue/Green)
- **Jenkins** 파이프라인이 마스터 브랜치 커밋 시 자동 빌드
- Docker Blue/Green 배포: `jbdatahub-blue` ↔ `jbdatahub-green` 교체
- 헬스체크: 300초(60회 × 5초) 타임아웃 — 앱 시작에 2~3분 소요
- 배포 실패 시 이전 컨테이너(green/blue) 자동 유지

## Git 워크플로우 (반드시 준수)
1. 브랜치 생성: **기능 단위 명칭** 사용
   - 기능 추가: `feature/{기능명}` → 예: `feature/semantic-search`, `feature/topic-grouping`
   - 버그 수정: `fix/{설명}` → 예: `fix/cache-manager-missing`, `fix/scheduler-super-admin`
   - 리팩터링: `refactor/{설명}` → 예: `refactor/upsert-performance`
2. 커밋 & 푸시: `git push https://jbkim4040:<PAT>@github.com/jbkim4040/jb-workspace.git <branch>`
3. PR 생성: `POST /repos/jbkim4040/jb-workspace/pulls`
4. Squash merge: `PUT /repos/.../pulls/{n}/merge` (merge_method: squash)
5. Jenkins 빌드 트리거: `POST /job/jb-workspace/build` (CSRF crumb 필요)
- **절대 master에 직접 푸시 금지**
- git LFS hang 시 GitHub API로 직접 파일 푸시

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

## 인프라 접속
- 서버: `ssh -i ~/Downloads/study.key ubuntu@158.180.65.135`
- Jenkins: `http://158.180.65.135:9090` (jb-datahub-admin / @jbdatahubadminjenkins)
- DB: Supabase PostgreSQL (메모리 참조)
