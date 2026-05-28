#!/bin/bash
# jb-workspace 배포 후 스모크 테스트
# 사용법: bash scripts/smoke-test.sh [BASE_URL]
# 기본값: https://localhost (앱 서버 내부 실행 기준)

BASE_URL="${1:-https://localhost}"

# URL 스킴 검증 — file:// gopher:// 등 내부 프로토콜 차단
[[ "$BASE_URL" =~ ^https?:// ]] || { echo "BASE_URL must start with http(s)://"; exit 1; }

PASS=0; FAIL=0

# 섹션 1 병렬 결과 수집용 임시 파일
_S1_TMP="/tmp/smoke_s1_$$"
trap 'rm -f "$_S1_TMP"' EXIT

check() {
  local name="$1" expected="$2"
  shift 2
  local actual
  actual=$(curl -sk -o /dev/null -w "%{http_code}" "$@")
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $name ($actual)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — expected $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

check_body() {
  local name="$1" pattern="$2"
  shift 2
  local body
  body=$(curl -sk "$@")
  if echo "$body" | grep -q "$pattern"; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — body에 '$pattern' 없음: $body"
    FAIL=$((FAIL + 1))
  fi
}

# 섹션 1 전용: 백그라운드에서 실행되며 결과를 임시 파일에 기록
_check_up_bg() {
  local name="$1"
  shift
  local actual
  actual=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "$@")
  local first="${actual:0:1}"
  # 2xx/3xx/4xx 모두 "서비스 응답 있음"으로 허용 (403=인증 필요한 관리 도구 포함)
  # 000=연결 실패, 5xx=서버 오류만 실패 처리
  if [ "$actual" != "000" ] && [ "$first" != "5" ]; then
    echo "PASS  ✓ $name ($actual)" >> "$_S1_TMP"
  else
    echo "FAIL  ✗ $name — got $actual (서비스 응답 없음 또는 서버 오류)" >> "$_S1_TMP"
  fi
}

echo "=== jb-workspace 스모크 테스트 ($(date '+%Y-%m-%d %H:%M:%S')) ==="
echo "대상: $BASE_URL"
echo ""

echo "[섹션 1 — 서비스 가용성 (7개 공개 서비스, 병렬 실행)]"
# portal.jbdatahub.com 은 아직 미배포 (DNS/nginx 미설정) — 배포 후 추가 예정
_check_up_bg "메인 포탈"       "https://jbdatahub.com" &
_check_up_bg "공공데이터 UI"   "https://datahub.jbdatahub.com" &
_check_up_bg "어드민 포탈"     "https://admin.jbdatahub.com" &
_check_up_bg "나침반"          "https://compass.jbdatahub.com" &
_check_up_bg "레시피 저장소"   "https://recipe.jbdatahub.com" &
_check_up_bg "Jenkins"         "https://jenkins.jbdatahub.com" &
_check_up_bg "Grafana"         "https://grafana.jbdatahub.com" &
wait  # 7개 완료 대기 (최대 10초)

# 결과 집계 (임시 파일에서 읽기)
while IFS= read -r line; do
  status="${line%% *}"
  msg="${line#* }"
  echo "  $msg"
  [ "$status" = "PASS" ] && PASS=$((PASS + 1)) || FAIL=$((FAIL + 1))
done < <(sort "$_S1_TMP" 2>/dev/null)
# 임베딩 서비스(10.0.0.188:8001)는 내부망 전용 — workflow.md Step 7-4에서 인프라 서버 경유로 별도 확인

echo ""
echo "[섹션 2 — API 기능 테스트]"

echo ""
echo "[공통]"
check_body "헬스체크 — status UP"     '"status":"UP"'   "$BASE_URL/api/health"
check_body "헬스체크 — DB UP"         '"db":"UP"'       "$BASE_URL/api/health"

echo ""
echo "[공공데이터 — 비인증 허용]"
check "목록 조회 (GET /list)"          "200" "$BASE_URL/api/public-data/list?page=0&size=1"
check "통계 조회 (GET /stats)"         "200" "$BASE_URL/api/public-data/stats"

echo ""
echo "[invoke — 인증 필수 확인 (#275 보안패치)]"
check "invoke 비인증 접근 → 401" "401" \
  -X POST "$BASE_URL/api/public-data/invoke" \
  -H "Content-Type: application/json" \
  -d '{"serviceKey":"smoke-test-key","endpointUrl":"https://apis.data.go.kr/test","params":{}}'

check "invoke SSRF 차단 (비인증) → 401" "401" \
  -X POST "$BASE_URL/api/public-data/invoke" \
  -H "Content-Type: application/json" \
  -d '{"serviceKey":"smoke-test-key","endpointUrl":"https://evil.com/steal","params":{}}'

echo ""
echo "[인증]"
check "로그인 실패 — 잘못된 자격증명 → 401" "401" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"smoke_bad","password":"smoke_bad"}'

check "보호 엔드포인트 — 비인증 → 401" "401" \
  "$BASE_URL/api/auth/me"

check "관리자 엔드포인트 — 비인증 → 401" "401" \
  "$BASE_URL/api/admin/users"

echo ""
echo "=========================================="
echo "결과: ✓ $PASS 통과 / ✗ $FAIL 실패"
echo "=========================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
