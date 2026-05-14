# jb-workspace

## 프로젝트 구조

```
jb-workspace/
├── .env                  # 시크릿 (Git 제외, .env.example 복사해서 생성)
├── .env.example          # 환경변수 템플릿 (커밋 O)
├── docker-compose.yml    # 전체 서비스 구성
├── jbDataHub/            # Spring Boot 백엔드
└── jbDataHubUI/          # React 프론트엔드
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

## 운영 배포 (Docker Compose)

```bash
# 루트 디렉토리에서 실행
# .env 파일에 실제 값이 채워져 있어야 합니다

# 전체 빌드 + 실행
docker-compose up --build -d

# 백엔드만 재빌드
docker-compose up --build -d jbdatahub

# 프론트엔드만 재빌드
docker-compose up --build -d jbdatahubui

# 로그 확인
docker-compose logs -f jbdatahub
docker-compose logs -f jbdatahubui

# 전체 종료
docker-compose down
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
