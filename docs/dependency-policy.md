# 의존성 버전 정책 (Dependency Versioning Policy)

## 원칙

### 1. **메이저 버전 고정**
모든 의존성은 메이저 버전을 명시한다. 메이저 업그레이드는 별도 PR + 호환성 검토.

### 2. **마이너/패치 자동 업데이트 허용**
- 백엔드 (Gradle): `:1.+` 또는 BOM 사용
- 프론트엔드 (npm): caret(`^`) 또는 tilde(`~`) 허용
- Python (pip): `==X.Y.Z` 명시 (보안 패치만 수동 적용)

### 3. **보안 패치는 즉시**
- Dependabot/Renovate 알림 시 24시간 내 패치
- CVE 영향도 확인 후 PR (Jenkinsfile.security pipeline 활용)

## 실제 정책 (현재 적용)

| Stack | 정책 | 예시 |
|-------|------|------|
| Spring Boot | BOM 사용 | `id 'org.springframework.boot' version '3.5.14'` |
| Spring 라이브러리 | BOM에 위임 | (버전 명시 안 함) |
| JJWT | 메이저 고정 | `io.jsonwebtoken:jjwt-api:0.12.6` |
| PostgreSQL JDBC | 메이저 고정 | `runtimeOnly 'org.postgresql:postgresql'` (BOM) |
| Caffeine | 마이너 고정 | `caffeine:3.1.8` |
| React | 메이저 고정 | `"react": "^19.x"` |
| axios | 마이너 고정 | `"axios": "~1.7.0"` |
| FastAPI | 패치 고정 | `fastapi==0.115.12` |
| asyncpg | 패치 고정 | `asyncpg==0.30.0` |
| reportlab | 패치 고정 | `reportlab==4.2.5` |

## CVE 대응 절차

1. Jenkinsfile.security `[3]Java SAST + [4]Trivy FS + [5]npm audit + [6]Trivy Image` 결과 확인
2. 영향 받은 의존성 파악
3. 패치 버전 확인
4. 새 브랜치 → 버전 업 → PR + 보안 빌드 재실행
5. SUCCESS 확인 후 머지

## 자동 도구

- **Dependabot**: GitHub 자동 PR (활성화 시 `.github/dependabot.yml`)
- **Renovate**: 더 세밀한 규칙 (선택)
