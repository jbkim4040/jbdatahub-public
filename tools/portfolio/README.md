# jbdatahub

> 공공데이터포털(data.go.kr) OpenAPI 메타·데이터 수집/조회 허브
> Spring Boot + React + PostgreSQL+pgvector · Blue/Green 무중단 배포 · 통합 모니터링 · 운영 자동화

[![Java](https://img.shields.io/badge/Java-21-orange.svg)]() [![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5-brightgreen.svg)]() [![React](https://img.shields.io/badge/React-18-blue.svg)]() [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791.svg)]() [![Docker](https://img.shields.io/badge/Docker-Blue%2FGreen-blue.svg)]()

---

## ✨ 한 줄 요약

> **70만+ 공공 OpenAPI 메타를 한 곳에서 검색·구독·관리하는 풀스택 데이터 허브 + 운영 어드민 포털 모노레포**

---

## 🏗 시스템 아키텍처

3대의 ARM 서버로 역할 분리, 자체 모니터링 스택 운영.

```
                ┌─────────────────────────────────────────────┐
                │  Cloudflare (DNS only, gray cloud)          │
                │  data-hub / admin / jenkins / grafana       │
                └──────────────────┬──────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌────────────────┐    ┌──────────────────────┐    ┌────────────────┐
│  WAS 서버       │    │  CI/모니터링 서버      │    │  DB 서버        │
│  (사용자 트래픽) │    │  (Jenkins/Prom/Loki) │    │  (PostgreSQL)   │
│  2 OCPU / 5 GB │    │  2 OCPU / 5 GB        │    │  1 OCPU / 6 GB │
└────────┬───────┘    └──────────┬───────────┘    └────────┬───────┘
         │                       │                         │
         ▼                       ▼                         ▼
      사용자                   운영자                    스키마/벡터
```

### 컨테이너 토폴로지
```
[WAS]
  ├── jbdatahub-blue   :8080  (Spring Boot — active)
  ├── jbdatahub-green  :8081  (Spring Boot — standby)
  ├── jbdatahubui      :3000  (React + Vite, nginx 서빙)
  ├── nginx            :443   (SSL 종단, upstream swap)
  └── promtail               (logs → Loki)

[CI / Monitoring]
  ├── jenkins                (CI/CD)
  ├── admin-portal-blue/green (FastAPI 관리 포털)
  ├── prometheus             (메트릭 수집)
  ├── alertmanager           (알림)
  ├── grafana                (대시보드)
  ├── loki                   (로그 집계)
  └── nginx-ssl              (SSL 종단)

[DB]
  └── PostgreSQL 16 + pgvector (시맨틱 검색용 임베딩)
```

---

## 🧱 모노레포 구조

```
.
├── server/jbdatahub/          # Spring Boot 3.5 백엔드
│   └── src/main/java/com/jb/datahub/
│       ├── auth/              # JWT + RefreshToken rotation + User 관리 + Audit
│       ├── config/            # Security/Async/Cache/RequestMDC Filter
│       └── publicdata/        # 수집/조회/스케줄러/구독/시맨틱 검색
│
├── ui/jbdatahub/              # React 18 + Vite 5 (사용자 UI)
│
├── admin-portal/              # 운영 어드민 포털 (FastAPI + React)
│   ├── backend/               # PR 모니터링, 배포, 구독 요청 처리
│   └── frontend/              # Tailwind CSS
│
├── monitoring/                # docker-compose (Prom + Alertmanager + Grafana + Loki)
├── infra/k6/                  # 부하 테스트 (smoke/baseline/stress/spike)
├── nginx/                     # 운영 nginx conf (Blue/Green 전환 템플릿)
├── tools/                     # safe_merge.py 등 운영 도구
├── docs/                      # ADR/운영 문서
├── Jenkinsfile                # 메인 빌드/배포 파이프라인
├── Jenkinsfile.portal         # admin-portal 별도 배포
├── Jenkinsfile.security       # 보안 게이트 (Gitleaks + Trivy + Semgrep)
├── deploy.sh                  # Blue/Green 전환 스크립트 (WAS)
└── docker-compose.yml         # 메인 컴포즈
```

---

## 🛠 기술 스택

### 백엔드 (`server/jbdatahub`)
- **언어/프레임워크**: Java 21, Spring Boot 3.5, Spring Security, JPA + Hibernate
- **인증**: JWT (JJWT 0.12.x), httpOnly Cookie, RefreshToken rotation, TokenBlacklist
- **DB**: PostgreSQL 16 + pgvector 0.6 (시맨틱 검색)
- **캐시**: Caffeine (영역별 TTL)
- **비동기**: WebClient (`Mono`) + CompletableFuture 3-페이지 병렬 fetch
- **배치 UPSERT**: JdbcTemplate `ON CONFLICT DO UPDATE` (JPA saveAll 대비 ~4×)
- **OpenAPI 문서**: Springdoc 2.8

### 프론트엔드 (`ui/jbdatahub`)
- React 18 + Vite 5 + React Router v6 + Axios (interceptor)
- Recharts 통계 차트, CSS Modules

### 어드민 포털 (`admin-portal`)
- FastAPI + httpx + asyncpg
- React + Tailwind CSS (현대적 UI)
- PR 모니터링, 빌드 상태, 배포 트리거, 구독 요청 처리

### 인프라/운영
- **CI**: Jenkins (Multi-stage 파이프라인, 변경 경로 감지, Blue/Green 헬스체크 300초)
- **모니터링**: Prometheus + Alertmanager + Grafana + Loki + Promtail
- **부하 테스트**: k6 (smoke/baseline/stress/spike) → Prometheus remote-write
- **보안 게이트**: Gitleaks + Trivy + Semgrep (GitHub Actions Multi-Agent PR Review)
- **무중단 배포**: nginx upstream swap, 컨테이너 헬스체크, 자동 롤백

---

## 💡 핵심 설계 결정

| 결정 | 이유 |
|---|---|
| **httpOnly Cookie + RefreshToken rotation** | XSS 시 토큰 탈취 방지, 재사용 공격 차단 |
| **Caffeine 영역별 TTL** | `stats` 10분, `related` 2분, `topics` 자동 무효화 — 메모리 효율 + freshness 균형 |
| **JdbcTemplate UPSERT** | JPA `saveAll` 대비 100건 처리 시 약 4× 빠름, 트랜잭션 1회로 묶음 |
| **CompletableFuture 3-page fetch** | 외부 API rate limit 내에서 최대 처리량, 직렬 대비 ~3× |
| **pgvector + K-means** | 임베딩 기반 의미 검색·유사도·토픽 클러스터링 (Top-K 0.1초 이내) |
| **Blue/Green nginx swap** | 빌드 실패 시 직전 컨테이너 유지, 다운타임 0 |
| **Multi-Agent PR Review (Gitleaks+Trivy+Semgrep+Test)** | 머지 전 4-에이전트 합의 (과반수 통과 + Branch Protection) |
| **3-서버 역할 분리** | WAS 부하와 CI 작업 격리, DB 외부 노출 차단 |

---

## 🔐 보안 정책 (SECURITY.md 참고)

- **시크릿 격리**: 모든 secret 환경변수만 (`@Value("${...}"`), 기본값 없음 → 미설정 시 기동 실패)
- **권한 계층**: `SUPER_ADMIN > ADMIN > USER > GUEST` (`@PreAuthorize("hasAnyRole(...)")`)
- **CORS 화이트리스트**: 운영 도메인만 허용
- **Rate Limit**: per-IP (Cloudflare `set_real_ip_from` chain으로 신뢰)
- **Audit Log**: 인증/관리자/구독 이벤트 비동기 기록 (`@Async`)
- **Input 검증**: 모든 입력 DTO에 `@Valid + @NotBlank + @Pattern + @Size`

---

## 🚀 로컬 실행

```bash
# 환경변수 파일 준비
cp .env.example .env  # 실제 값 채우기

# DB 준비
docker run -d --name pg -e POSTGRES_PASSWORD=... -p 5432:5432 pgvector/pgvector:pg16

# 백엔드
cd server/jbdatahub
./gradlew bootRun

# 프론트엔드
cd ui/jbdatahub
npm install && npm run dev
```

---

## 📊 성과 지표 (운영 기준)

- **응답 시간**: API 평균 p50 50ms / p95 300ms
- **수집 처리량**: 외부 API 70만 건 / 약 5분 (3-페이지 병렬)
- **무중단 배포**: Blue/Green 전환 평균 30초, 다운타임 0초
- **보안 게이트**: 머지 전 Gitleaks/Trivy/Semgrep 통과 필수

---

## 📝 라이선스

MIT (see [LICENSE](LICENSE))

---

> 본 저장소는 운영 중인 시스템의 **포트폴리오 공개판**입니다.
> 실제 운영 서버 IP/도메인/비밀값은 마스킹되었으며, 코드 구조와 기술 선택을 보여주기 위한 스냅샷입니다.
