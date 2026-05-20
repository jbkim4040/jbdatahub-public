## Git 워크플로우 (자동 실행 — 사용자 별도 지시 불필요)

작업 단위가 완료되면 아래 순서를 **자동으로** 실행한다.

1. **브랜치 생성**: 기능 단위 명칭
   - 기능 추가: `feature/{기능명}` / 버그 수정: `fix/{설명}` / 리팩터링: `refactor/{설명}`
2. **커밋 & 푸시**: `git push https://jbkim4040:<PAT>@github.com/jbkim4040/jb-workspace.git <branch>`
3. **PR 생성**: `POST /repos/jbkim4040/jb-workspace/pulls`
4. **에이전트 코드리뷰 (자동 실행)**: security-reviewer · performance-reviewer · style-reviewer 3개 Agent 병렬 호출
   - Critical/High 이슈 → 즉시 수정 후 재커밋 → 재리뷰
   - Medium/Low 이슈 → 수정 또는 Notion에 후속 작업으로 기록 후 진행
   - **ultrareview** (`/ultrareview <PR번호>`)는 사용자가 명시적으로 요청할 때만 사용
   - 리뷰 결과 → Notion "📊 개선 이력 & 성능 수치 기록" 하위에 PR별 페이지로 자동 기록
5. **Squash merge (자동)**: 리뷰 이슈 없으면 즉시 머지
   `PUT /repos/jbkim4040/jb-workspace/pulls/{n}/merge` (merge_method: squash)
6. **Jenkins 빌드 트리거 (자동)**: 머지 직후 실행 → `docs/claude/infra.md` 참조

- **절대 master에 직접 푸시 금지** (docs 전용 변경 제외 — CLAUDE.md 등)
- git LFS hang 시 GitHub API로 직접 파일 푸시

---

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

- `~/.claude/projects/-Users-gimjeongbin/memory/MEMORY.md` 항상 우선 참조
- 신규 서버/계정/접속 정보는 즉시 memory에 저장
- 사용자 호칭/스타일 피드백은 `feedback_*.md`로 분리
