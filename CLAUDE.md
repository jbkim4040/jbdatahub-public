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
└── ui/jbdatahub/       # React + Vite 프론트엔드
    └── src/
        ├── api/        # Axios API 호출 (publicApi.js, http.js)
        ├── context/    # AuthContext (JWT 토큰 관리)
        └── pages/      # CollectPage, ListPage, SchedulerPage, UsersPage, HomePage
```

## 배포 방식 (Blue/Green)
- **Jenkins** 파이프라인이 마스터 브랜치 커밋 시 자동 빌드
- Docker Blue/Green 배포: `jbdatahub-blue` ↔ `jbdatahub-green` 교체
- 헬스체크: 300초(60회 × 5초) 타임아웃 — 앱 시작에 2~3분 소요
- 배포 실패 시 이전 컨테이너(green/blue) 자동 유지

@docs/claude/workflow.md
@docs/claude/infra.md
@docs/claude/backend.md
