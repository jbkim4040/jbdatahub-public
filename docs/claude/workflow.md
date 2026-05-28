## 절대 금지 가드레일 (운영 매뉴얼 준수)

다음 항목은 **어떠한 상황에서도 자동 실행 불가** — 사용자 명시적 동의 필요:

| 분류 | 금지 행위 |
|------|-----------|
| **DB** | `ALTER TABLE`, `DROP TABLE`, `CREATE TABLE`, 마이그레이션 스크립트 실행 |
| **인프라** | 프로세스/컨테이너 강제 종료(`kill`, `docker rm -f`), DB 프로세스 중단, 유료 클라우드 리소스 생성 |
| **인증·라우팅** | OAuth 설정 변경, Nginx 라우팅/도메인/URL 구조 변경 (아래 '자동 진행하면 안 되는 것' 참조) |
| **보안** | CORS 허용 출처 확장 — `jbdatahub.com`, `admin.jbdatahub.com`만 허용 |
| **JWT** | Access Token 15분 / Refresh Token 7일 규격 변경 |
| **로그** | `System.out.println` 또는 대량 디버그 로그 추가 (Loki 디스크 풀 방지) |
| **master** | 직접 Push 절대 금지 (docs 전용 변경 제외) |
| **SSH 키** | `~/Downloads/*.key`는 chmod 600 유지; 키 유출 시 서버 `authorized_keys` 즉시 삭제 후 재발급 |

> 🚨 **스모크 테스트 1개라도 실패하면 즉시 배포 실패 처리** — 자동 롤백 후 원인 분석

---

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
7. **Jenkins 빌드 완료 대기 + 캐시 웜업 + 스모크 테스트 (자동)**:
   ```bash
   # 1) 빌드 번호 확인 후 완료 폴링 (최대 5분)
   BUILD_NUM=$(ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 \
     "curl -s -u 'jb-datahub-admin:@jbdatahubadminjenkins' \
     'http://127.0.0.1:19090/job/jb-workspace/lastBuild/api/json' \
     | python3 -c \"import sys,json; print(json.load(sys.stdin)['number'])\"")

   for i in $(seq 1 30); do
     RESULT=$(ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 \
       "curl -s -u 'jb-datahub-admin:@jbdatahubadminjenkins' \
       'http://127.0.0.1:19090/job/jb-workspace/$BUILD_NUM/api/json' \
       | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('result','BUILDING'))\"")
     [ "$RESULT" != "BUILDING" ] && [ "$RESULT" != "None" ] && break
     sleep 10
   done

   # 2) 캐시 웜업 — 라우팅 전환 전 Caffeine 캐시를 미리 채움 (최소 5회 호출)
   # Blue/Green 교체 직후 신규 컨테이너의 cold start 캐시 누락 방지
   NEW_CONTAINER_PORT=$(ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 \
     "docker inspect --format='{{range .NetworkSettings.Ports}}{{(index . 0).HostPort}}{{end}}' \
     \$(docker ps --filter 'name=jbdatahub' --format '{{.Names}}' | head -1)")
   # 포트 값은 숫자만 허용 — 컨테이너 메타데이터 오염으로 인한 인젝션 방지
   [[ "$NEW_CONTAINER_PORT" =~ ^[0-9]{4,5}$ ]] || NEW_CONTAINER_PORT="8080"
   ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 \
     "curl -sk -o /dev/null http://localhost:${NEW_CONTAINER_PORT}/api/public-data/stats & \
      curl -sk -o /dev/null http://localhost:${NEW_CONTAINER_PORT}/api/public-data/list?page=0\&size=1 & \
      wait"
   echo "캐시 웜업 완료 (stats + list 병렬 호출)"

   # 3) 스모크 테스트 실행 (섹션 1: 8개 공개 서비스 + 섹션 2: API 9개)
   scp -i ~/Downloads/jb-service.key scripts/smoke-test.sh ubuntu@140.245.74.59:/tmp/smoke-test.sh
   ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 "bash /tmp/smoke-test.sh"

   # 4) 임베딩 서비스 가용성 확인 (내부망 전용 — 인프라 서버 경유)
   EMBED_STATUS=$(ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 \
     "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://10.0.0.188:8001/health")
   if [ "$EMBED_STATUS" != "200" ]; then
     echo "🚨 임베딩 서비스 비정상: HTTP $EMBED_STATUS — 배포 실패 처리"
     exit 1
   fi
   echo "✓ 임베딩 서비스 정상 ($EMBED_STATUS)"
   ```
   - 스모크 테스트 **1개라도 실패 시** → 즉시 롤백 프로토콜 실행 (아래 참조)
   - 테스트 파일: `scripts/smoke-test.sh` (섹션 1: 공개 서비스 7개 + 섹션 2: API 9개)
   - `portal.jbdatahub.com`은 미배포 — DNS/nginx 설정 후 섹션 1에 추가

---

## 🚨 롤백 프로토콜

배포 후 스모크 테스트 실패 또는 서비스 장애 감지 시:

```bash
# 1) 현재 active 컨테이너 확인
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 "docker ps | grep jbdatahub"

# 2) 이전 컨테이너(idle 상태)로 nginx upstream 전환
#    (Blue/Green: Jenkinsfile의 rollback 단계와 동일 로직)
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 "
  IDLE=\$(docker ps -a --filter 'name=jbdatahub' --format '{{.Names}}' | grep -v \$(docker ps --filter 'name=jbdatahub' --format '{{.Names}}'))
  docker start \$IDLE 2>/dev/null || true
  echo \"롤백 대상: \$IDLE\"
"

# 3) 롤백 완료 후 스모크 테스트 재실행
scp -i ~/Downloads/jb-service.key scripts/smoke-test.sh ubuntu@140.245.74.59:/tmp/smoke-test.sh
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 "bash /tmp/smoke-test.sh"
```

> 롤백 후에도 실패하면 infra server의 Grafana/Loki에서 로그 분석 후 hotfix PR 생성

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
- **라우트·URL 변경 (승인 필수)**: 아래 항목 중 하나라도 해당하면 실행 전 사용자 승인 요청
  - nginx `server_name`, `location`, `proxy_pass`, `return`/`rewrite` 변경
  - React Router (`<Route path=...>`) 경로 추가·수정·삭제
  - Spring Boot `@RequestMapping` / `@GetMapping` 등 API 경로 변경
  - `nginx -s reload` / nginx 컨테이너 재시작
  - Cloudflare DNS A/CNAME 레코드 변경
  - 서비스 카드(HomePage `SERVICES` 배열)의 `host`·`url` 필드 변경
  > 승인 요청 시 "변경 전→후 라우팅 경로"를 명시할 것

위 항목은 사용자 명시 동의 필요.

### 메모리 활용

- `~/.claude/projects/-Users-gimjeongbin/memory/MEMORY.md` 항상 우선 참조
- 신규 서버/계정/접속 정보는 즉시 memory에 저장
- 사용자 호칭/스타일 피드백은 `feedback_*.md`로 분리
