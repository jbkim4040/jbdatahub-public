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

### 서버 목록
| 서버 | IP | SSH 키 | 용도 |
|------|-----|--------|------|
| 인프라 서버 | `168.107.20.90` | `~/Downloads/jb-manager.key` | Jenkins, Nginx-ssl, Grafana, Prometheus, Loki |
| 앱 서버 | `140.245.74.59` | `~/Downloads/jb-service.key` | jbdatahub-blue/green, jbdatahubui, nginx |
| DB 서버 | `152.69.232.44` | `~/Downloads/jbdbkey.key` | PostgreSQL (hostname: jb-db) |
| 임베드 서비스 | `10.0.0.188:8001` (내부망) | 인프라 서버 경유 | 벡터 임베딩 서비스 |

### SSH 접속
```bash
# 인프라 서버 (Jenkins, 모니터링)
ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90

# 앱 서버 (실제 서비스 컨테이너)
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59

# DB 서버
ssh -i ~/Downloads/jbdbkey.key ubuntu@152.69.232.44

# 임베드 서비스 (내부망 — 인프라 서버에서만 접근)
# ssh 후: curl http://10.0.0.188:8001/health
```

> ⚠️ `jb-datahub-db-server.key`, `jbdatahubdbserver.key` 는 권한(0644)이 열려있어 SSH 거부됨 — 사용 전 `chmod 600` 필요

### 메인 서버 컨테이너 구성
| 컨테이너 | 포트 | 설명 |
|----------|------|------|
| `jenkins` | `127.0.0.1:19090→8080` | CI/CD |
| `prometheus` | `127.0.0.1:19091→9090` | 메트릭 수집 |
| `grafana` | `127.0.0.1:13000→3000` | 모니터링 대시보드 |
| `nginx-ssl` | 443 | 리버스 프록시 |
| `admin-portal-blue` | `172.17.0.1:18080` | 관리 포털 |
| `loki` | `0.0.0.0:3100` | 로그 수집 |

### Jenkins 빌드 트리거
```bash
ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 "
  CRUMB=\$(curl -s -c /tmp/jc -u 'jb-datahub-admin:@jbdatahubadminjenkins' \
    'http://127.0.0.1:19090/crumbIssuer/api/json' | python3 -c \"import sys,json; print(json.load(sys.stdin)['crumb'])\")
  curl -s -o /dev/null -w '%{http_code}' -X POST \
    -b /tmp/jc -u 'jb-datahub-admin:@jbdatahubadminjenkins' \
    -H \"Jenkins-Crumb: \$CRUMB\" -d 'json={}' \
    'http://127.0.0.1:19090/job/jb-workspace/build'
"
# 201 반환 시 성공
```

### 서버 정보 변경 후 접속 테스트 절차
서버 IP·키·포트 등 인프라 정보를 변경한 경우 반드시 아래 순서로 검증한다.

```bash
# 1. 인프라 서버 SSH
ssh -i ~/Downloads/jb-manager.key -o ConnectTimeout=5 ubuntu@168.107.20.90 "echo ok"

# 2. 앱 서버 SSH
ssh -i ~/Downloads/jb-service.key -o ConnectTimeout=5 ubuntu@140.245.74.59 "echo ok"

# 3. DB 서버 SSH
ssh -i ~/Downloads/jbdbkey.key -o ConnectTimeout=5 ubuntu@152.69.232.44 "echo ok"

# 4. Jenkins 응답 확인 (인프라 서버 경유)
ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 \
  "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:19090/login"

# 5. 앱 헬스체크 (앱 서버 경유)
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 \
  "curl -sk https://localhost/api/health"

# 6. 임베드 서비스 확인 (인프라 서버 경유)
ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 \
  "curl -s -o /dev/null -w '%{http_code}' http://10.0.0.188:8001/health"

# 7. 앱 컨테이너 상태 확인
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 "docker ps | grep jbdatahub"
```

- DB: Supabase PostgreSQL → `DB_URL=jdbc:postgresql://152.69.232.44:5432/jbdatahub`


## 작업 완료 후 자동 수행 (필수)

매 작업 단위 완료 시 다음을 자동 수행한다:

1. **누적 요청 사항 점검**: 사용자의 직전 ~ 누적 메시지 중 아직 처리 안 된 항목이 있는지 확인
2. **미완료 작업 자동 시작**: 결정 필요 없는 항목은 즉시 다음 작업 시작
3. **결정 필요 시 단 1번 질문**: 옵션 선택 (A/B/C)이 필요하면 짧게 확인 후 자동 진행
4. **변경 사항 노션 기록**: 기능 추가/수정/삭제 + 원인(왜) + 변경 전→후 비교 → "📊 개선 이력 & 성능 수치 기록" 페이지에 append
5. **로그 분석**: 빌드/배포 실패 시 즉시 로그 분석 + 원인 fix
6. **상태 보고**: 5건 이상 처리하거나 30분 이상 작업 시 진행률 + 남은 작업 요약

### 작업 진행 우선순위 (자동)

1. **에러/장애 fix** (HTTP 5xx, 빌드 실패, OOM 등) — 최우선
2. **사용자가 직접 지정한 작업** (방금 요청한 것)
3. **누적 보류 작업** (보안 CRITICAL/HIGH/MEDIUM/LOW 순)
4. **자동화/모니터링 개선**
5. **문서 정리** (마지막)

### 자동 진행하면 안 되는 것

- 운영 환경에 영향 큰 변경: 서버 종료, DB 삭제, 강제 reset
- 비용 발생: 유료 API/인스턴스 생성
- 외부 시스템 변경: 도메인 등록, 결제 정보
- 사용자의 OAuth 인증 (data.go.kr 로그인 등)

위 항목은 사용자 명시 동의 필요.

### 메모리 활용

- `~/.claude/projects/-Users-gimjeongbin-Desktop/memory/MEMORY.md` 항상 우선 참조
- 신규 서버/계정/접속 정보는 즉시 memory에 저장
- 사용자 호칭/스타일 피드백은 `feedback_*.md`로 분리
