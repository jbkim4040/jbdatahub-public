# jb-workspace

공공데이터포털 OpenAPI 메타 + 데이터 수집 허브. Spring Boot 백엔드, React 프론트, 자체 운영 PostgreSQL 16 + pgvector, Blue/Green 무중단 배포, 통합 모니터링(Loki+Grafana+Prometheus)과 자동화된 운영 도구(Admin Portal)를 갖춘 풀스택 시스템.

---

## 아키텍처 (2026-05-18 기준)

3대의 Oracle Cloud Ampere A1 서버로 역할 분리.

```
                ┌─────────────────────────────────────────────┐
                │  Cloudflare (DNS only, SSL passthrough)     │
                └──────────────────┬──────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
  jbdatahub.com           admin.jbdatahub.com    jenkins / grafana / prometheus
   www.jbdatahub.com               │                .jbdatahub.com
        │                          │                          │
┌───────┴─────────┐     ┌──────────┴────────┐     ┌──────────┴──────────┐
│   WAS 서버      │     │  Admin Portal     │     │   CI / 모니터링      │
│ 140.245.74.59   │     │ (CI 서버 동거)    │     │ 168.107.20.90       │
│ Ampere A1 ARM   │     │                   │     │ Ampere A1 ARM       │
│                 │     │                   │     │                     │
│ • nginx 80/443  │     │ • FastAPI         │     │ • Jenkins (Docker)  │
│ • Spring Boot   │     │ • React Vite      │     │ • Prometheus        │
│   Blue/Green    │     │ • asyncpg → DB    │     │ • Grafana + Loki    │
│ • React UI      │     │ • Playwright      │     │ • Promtail + AlertM │
│ • Let's Encrypt │     │ • nginx-ssl 443   │     │ • embed_service     │
└────────┬────────┘     └──────────┬────────┘     └──────────┬──────────┘
         │                         │                         │
         └───────────────┬─────────┴─────────────┬───────────┘
                         ▼                       ▼
                ┌─────────────────────────────────────┐
                │   DB 서버 (152.69.232.44)           │
                │   Ampere A1 ARM · 1 OCPU · 8 GB     │
                │   PostgreSQL 16 + pgvector 0.6.0    │
                │   shared_buffers 1.5G / cache 3G    │
                └─────────────────────────────────────┘
```

---

## 도메인 / 엔드포인트

| 도메인 | 용도 | 비고 |
|---|---|---|
| `jbdatahub.com` / `www.jbdatahub.com` | 메인 UI (React) | WAS 서버 |
| `admin.jbdatahub.com` | 운영 Admin Portal (PR/배포/리포트/공공API/에러) | CI 서버 |
| `jenkins.jbdatahub.com` | Jenkins CI/CD | CI 서버 (basic auth) |
| `grafana.jbdatahub.com` | 통합 모니터링 + 로그 대시보드 | CI 서버 |
| `prometheus.jbdatahub.com` | 메트릭 (basic auth) | CI 서버 |

전 도메인 Let's Encrypt SAN 인증서 사용, Cloudflare는 DNS only (gray cloud).

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 백엔드 | Spring Boot 3.5.14, Java 21, JPA/Hibernate, Springdoc OpenAPI |
| 프론트엔드 | React 18, Vite 5, Recharts |
| Admin Portal | FastAPI + asyncpg, React 18, Playwright Chromium |
| DB | 자체 운영 PostgreSQL 16.13 + pgvector 0.6.0 (HNSW 인덱스) |
| 인증 | JWT (Access 15분, Refresh 7일), httpOnly cookie 저장 |
| 캐시 | Caffeine (TTL 10분, 수집 완료 시 자동 무효화) |
| 모니터링 | Prometheus + Grafana + Loki + Promtail + Alertmanager |
| 알림 | Slack Incoming Webhook (에러 시그니처 자동 알림) |
| 배포 | Docker + nginx Blue/Green, Jenkins CI/CD |
| 보안 | OWASP ZAP DAST + Dependency-Check (Jenkins job) |

---

## 주요 기능

### 본 시스템 (jbDataHub)

- **공공데이터 수집**: 공공데이터포털 OpenAPI 목록 자동 수집 (병렬 3페이지, 페이지당 ~376ms)
- **데이터 조회**: 데이터셋·파일데이터·표준데이터 유형별 조회/정렬/시각화
- **스케줄 관리**: 년/월/일/시간 단위 자동 수집 (cron 기반)
- **권한**: SUPER_ADMIN > ADMIN > USER 3단계
- **Swagger UI**: `/swagger-ui.html` (ADMIN/SUPER_ADMIN만 접근 가능)

### Admin Portal (운영자 전용, https://admin.jbdatahub.com)

- **PR 리뷰**: GitHub PR 목록 + Claude 자동 코드 리뷰 + squash merge
- **보안 이력**: ZAP/Dependency-Check 결과 보관 + Critical/High 추적
- **배포 관리**: Jenkins 빌드 트리거, 상태/로그 조회, Blue/Green 전환
- **통합 리포트** (`/reports`): code_review·security_scan·deploy_summary 등 4종 리포트 PDF/DOCX 다운로드 (한국어 폰트 + 표/코드블록 지원)
- **공공API 신청** (`/subscriptions`): data.go.kr 사용신청 자동화 (Playwright SSO 우회 + httpx fallback)
- **에러 알림** (`/errors`): Loki 5분 폴링 → DB 시그니처 누적 → 신규 발견 시 Slack 알림

---

## 모니터링 / 로그

### 통합 로그 (Loki)

- 3대 서버 모든 컨테이너 로그 수집 (Promtail 3 인스턴스)
- WAS/DB → CI Loki 경로: `https://grafana.jbdatahub.com/loki/api/v1/push` (basic auth)
- 보존 30일
- Grafana 대시보드: `All Services Logs` (server/container 필터, errors-only 패널, log rate / error rate 시계열)

### 에러 모니터 데몬

- CI 서버 systemd timer `error-monitor.timer` 5분 주기
- Loki에서 `error|exception|traceback|fatal|panic|5xx` 패턴 폴링
- 시그니처 정규화 후 PostgreSQL `error_alerts` 테이블에 UPSERT
- 신규 시그니처 발생 시 Slack Webhook으로 알림 (블록 포맷 + 대시보드 링크)
- 조회/처리: `https://admin.jbdatahub.com/errors`

### 메트릭

- Spring Boot Micrometer → Prometheus → Grafana (JVM, HTTP, DB pool, GC)
- nginx stub_status + Promtail
- Alertmanager: 5xx burst / DB latency / disk full 룰

---

## 프로젝트 구조

```
jb-workspace/
├── .env.example           # 환경변수 템플릿
├── docker-compose.yml     # nginx + blue/green 백엔드 + 프론트
├── Jenkinsfile            # CI/CD 파이프라인
├── nginx/                 # Blue/Green 전환 설정
├── jbDataHub/             # Spring Boot 백엔드
└── jbDataHubUI/           # React 프론트엔드

# 별도 리포지토리 (운영)
admin-portal/              # FastAPI + React Admin Portal
infra/                     # nginx-ssl, monitoring, error-monitor 설정
```

---

## 로컬 개발

```bash
# 백엔드
cd jbDataHub
./gradlew bootRun --args='--spring.profiles.active=local'

# 프론트엔드
cd jbDataHubUI
npm install && npm run dev    # http://localhost:3000
```

`application-local.yml`에 로컬 DB 연결, JWT 시크릿 등을 설정. Git 커밋 금지.

---

## 빌드 / 배포

### 빌드

```bash
# 백엔드
cd jbDataHub && ./gradlew bootJar
docker build -t jbdatahub ./jbDataHub

# 프론트엔드
cd jbDataHubUI && npm run build
docker build -t jbdatahubui ./jbDataHubUI
```

### 운영 배포 (Blue/Green)

```bash
# WAS 서버에서 (jb-workspace 디렉토리)
docker compose up --build -d jbdatahub-blue   # 또는 -green
# nginx upstream 전환 + health check
docker compose logs -f jbdatahub-blue
```

### CI/CD

1. 기능 단위 브랜치 생성 (`feature/{name}`, `fix/{name}`, `refactor/{name}`)
2. PR 생성 + Claude 자동 리뷰 (Admin Portal)
3. PR squash merge → Jenkins 빌드 자동 트리거
4. Jenkins가 Docker 이미지 빌드 + WAS Blue/Green 전환

> `master` 브랜치 직접 push 금지. 모든 변경은 PR 경유.

---

## API 문서

- 로컬: http://localhost:8080/swagger-ui.html
- 운영: https://jbdatahub.com/swagger-ui.html (ADMIN/SUPER_ADMIN만)

---

## 환경변수 관리 규칙

| 파일 | 용도 | Git 커밋 |
|---|---|---|
| `.env.example` | 템플릿 | ✅ |
| `.env` | 운영 시크릿 (DB, Jenkins, Claude API key 등) | ❌ |
| `application-local.yml` | 로컬 시크릿 | ❌ |
| `application-prod.yml` | 운영 환경변수 참조 (시크릿은 ${ENV}) | ✅ |
| `.env.local`, `.env.production` | 프론트 빌드용 | local만 ❌ |

> 실제 비밀번호 / API 키가 들어간 파일은 절대 커밋하지 않습니다.

---

## 보안

- 47건 보안 검토 처리 완료 (CRITICAL 7 / HIGH 14 / MEDIUM 17 / LOW 9)
- JWT httpOnly cookie + SameSite=Strict (XSS 방어)
- BCrypt 비밀번호, scram-sha-256 PostgreSQL 인증
- 호스트 iptables + OCI Security List 이중 방어, DB는 WAS/CI/현재 IP만 5432 허용
- Webhook secret 검증 (GitHub PR webhook)
- Let's Encrypt SAN 인증서 + HSTS + nginx CSP

## 라이선스

내부 프로젝트. 외부 공개 시 별도 라이선스 부여 예정.
