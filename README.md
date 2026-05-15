# jb-workspace

공공데이터포털 OpenAPI 목록을 수집·관리하는 데이터 허브. Spring Boot 백엔드와 React 프론트엔드로 구성됩니다.

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 백엔드 | Spring Boot 3.5.14, Java 21 |
| 프론트엔드 | React 18.3.1, Vite 5.3.1 |
| DB | Supabase PostgreSQL (pgBouncer Transaction 모드) |
| 인증 | JWT (JJWT 0.12.x) — Access Token 15분, Refresh Token 7일 |
| 캐시 | Caffeine (stats 캐시 10분 TTL) |
| 차트 | Recharts 2.x |
| 배포 | Docker Compose + Nginx, Blue/Green 무중단 배포 |
| CI/CD | Jenkins (GitHub PR merge → 자동 빌드) |
| API 문서 | Springdoc OpenAPI (Swagger UI `/swagger-ui.html`) |

---

## 주요 기능

- **공공데이터 수집**: 공공데이터포털 OpenAPI 목록 자동 수집 (병렬 3페이지 동시 fetch, 페이지당 ~376ms)
- **데이터 조회**: 데이터셋·파일데이터·표준데이터 유형별 조회, 정렬, 통계 시각화
- **스케줄 관리**: 년/월/일/시간 단위 수집 스케줄 설정 및 즉시 실행
- **사용자 권한**: SUPER_ADMIN > ADMIN > USER 3단계 권한 관리
- **JWT 인증**: Stateless 인증, Refresh Token 기반 자동 갱신
- **성능 캐싱**: Caffeine 캐시로 통계 API 응답 속도 개선, 수집 완료 시 자동 무효화

---

## 프로젝트 구조

```
jb-workspace/
├── .env                  # 시크릿 (Git 제외, .env.example 복사해서 생성)
├── .env.example          # 환경변수 템플릿 (커밋 O)
├── docker-compose.yml    # 전체 서비스 구성 (nginx, blue/green 백엔드, 프론트엔드)
├── Jenkinsfile           # CI/CD 파이프라인 정의
├── nginx/                # Nginx 설정 (Blue/Green 전환 포함)
├── jbDataHub/            # Spring Boot 백엔드
│   ├── src/
│   ├── build.gradle
│   └── Dockerfile
└── jbDataHubUI/          # React 프론트엔드
    ├── src/
    ├── package.json
    └── Dockerfile
```

---

## 최초 설정

```bash
# 1. 루트 환경변수 파일 생성
cp .env.example .env
# .env 열어서 실제 DB, API 키 값 입력

# 2. 프론트엔드 환경변수 파일 생성
cd jbDataHubUI
cp .env.example .env.local
# .env.local 열어서 백엔드 주소 확인
cd ..
```

---

## 로컬 개발 실행

### 백엔드 (Spring Boot)

```bash
cd jbDataHub

# local 프로필로 실행 (application-local.yml 사용)
./gradlew bootRun --args='--spring.profiles.active=local'

# 또는 IntelliJ > Run > Edit Configurations
# Active profiles: local
```

`application-local.yml`에 DB, API 키가 저장됩니다. Git에 올라가지 않습니다.

### 프론트엔드 (React + Vite)

```bash
cd jbDataHubUI

npm install       # 최초 1회
npm run dev       # http://localhost:3000 실행
```

`.env.local`의 `VITE_API_BASE_URL` 기준으로 백엔드에 프록시 연결됩니다.

---

## 빌드

### 백엔드만 빌드

```bash
cd jbDataHub
./gradlew bootJar

# 결과물: jbDataHub/build/libs/jbDataHub-*.jar
```

### 프론트엔드만 빌드

```bash
cd jbDataHubUI
npm run build

# 결과물: jbDataHubUI/dist/
```

### Docker 이미지 개별 빌드

```bash
# 백엔드만
docker build -t jbdatahub ./jbDataHub

# 프론트엔드만
docker build -t jbdatahubui ./jbDataHubUI
```

---

## 운영 배포 (Docker Compose + Blue/Green)

서비스는 `jbdatahub-blue`와 `jbdatahub-green` 두 컨테이너로 운영됩니다.  
Nginx가 트래픽을 한쪽으로만 라우팅하며, 배포 시 반대편 컨테이너를 교체한 뒤 Nginx 설정을 전환합니다.

```bash
# 루트 디렉토리에서 실행
# .env 파일에 실제 값이 채워져 있어야 합니다

# 전체 빌드 + 실행
docker-compose up --build -d

# 백엔드만 재빌드 (blue)
docker-compose up --build -d jbdatahub-blue

# 프론트엔드만 재빌드
docker-compose up --build -d jbdatahubui

# 로그 확인
docker-compose logs -f jbdatahub-blue
docker-compose logs -f jbdatahub-green
docker-compose logs -f jbdatahubui

# 전체 종료
docker-compose down
```

---

## CI/CD (Jenkins)

1. GitHub에서 새 브랜치 생성 후 PR 생성
2. PR merge (squash) 시 Jenkins 빌드 자동 트리거
3. Jenkins가 Docker 이미지를 빌드하고 Blue/Green 전환 수행

> Jenkins URL: `http://158.180.65.135:9090`

---

## API 문서

로컬 또는 서버 실행 후 아래 URL에서 Swagger UI를 확인할 수 있습니다.

```
http://localhost:8080/swagger-ui.html
```

---

## 환경변수 관리 규칙

| 파일 | 용도 | Git 커밋 |
|---|---|---|
| `.env.example` | 템플릿 (실제 값 없음) | ✅ |
| `.env` | 운영 시크릿 | ❌ |
| `application-local.yml` | 로컬 개발 시크릿 | ❌ |
| `application-prod.yml` | 운영 환경변수 참조 | ✅ |
| `.env.local` (프론트) | 로컬 개발 설정 | ❌ |
| `.env.production` (프론트) | 운영 설정 (시크릿 없음) | ✅ |

> **규칙**: 실제 비밀번호·API 키가 들어간 파일은 절대 커밋하지 않습니다.
