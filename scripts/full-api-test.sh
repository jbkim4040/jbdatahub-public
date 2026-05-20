#!/bin/bash
# jb-workspace 전체 API 테스트 (41개 엔드포인트)
# 사용법: bash scripts/full-api-test.sh [BASE_URL]

BASE_URL="${1:-https://localhost}"
PASS=0; FAIL=0; WARN=0
JWT=""         # 로그인 후 JWT 토큰
REFRESH=""     # 리프레시 토큰

LIST_ID="15158620"
TOPIC_ID="22"
DATA_ITEM_ID="uddi:56a36cae-bc4a-4bba-b47e-b7abd91b512d"
ENC_DATA_ITEM_ID=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DATA_ITEM_ID'))")
QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('날씨'))")

echo "=== jb-workspace 전체 API 테스트 ($(date '+%Y-%m-%d %H:%M:%S')) ==="
echo "대상: $BASE_URL"
echo ""

# ─── 헬퍼 ────────────────────────────────────────────────────────────────────
_curl() {
  local args=()
  [ -n "$JWT" ] && args+=(-H "Cookie: jb_token=$JWT")
  curl -sk "${args[@]}" "$@"
}

check() {
  local label="$1" expected="$2"; shift 2
  local code; code=$(_curl -o /dev/null -w "%{http_code}" "$@")
  if [ "$code" = "$expected" ]; then
    echo "  ✓ $label ($code)"; PASS=$((PASS+1))
  else
    echo "  ✗ $label — expected $expected, got $code"; FAIL=$((FAIL+1))
  fi
}

check_ext() {   # 외부 API 연동 — 오류 시 WARN만
  local label="$1" expected="$2"; shift 2
  local code; code=$(_curl -o /dev/null -w "%{http_code}" "$@")
  if [ "$code" = "$expected" ]; then
    echo "  ✓ $label ($code)"; PASS=$((PASS+1))
  else
    echo "  ⚠ $label — expected $expected, got $code (외부 API — 보고 후 계속)"; WARN=$((WARN+1))
  fi
}

check_body() {
  local label="$1" pattern="$2"; shift 2
  local body; body=$(_curl "$@")
  if echo "$body" | grep -q "$pattern"; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label — '$pattern' 없음: ${body:0:120}"; FAIL=$((FAIL+1))
  fi
}

login() {
  local user="$1" pass="$2"
  local resp
  resp=$(curl -sk -D - -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}")
  JWT=$(echo "$resp" | grep -i "set-cookie: jb_token=" | sed 's/.*jb_token=//;s/;.*//' | tr -d '\r')
  REFRESH=$(echo "$resp" | grep -i "set-cookie: jb_refresh=" | sed 's/.*jb_refresh=//;s/;.*//' | tr -d '\r')
}

logout() {
  _curl -o /dev/null -X POST "$BASE_URL/api/auth/logout" > /dev/null
  JWT=""; REFRESH=""
}

# ─── 1. 공통 ─────────────────────────────────────────────────────────────────
echo "[1] 공통"
check_body "GET  /health — status UP" '"status":"UP"' "$BASE_URL/api/health"
check_body "GET  /health — DB UP"     '"db":"UP"'     "$BASE_URL/api/health"

# ─── 2. 인증 — 비로그인 ──────────────────────────────────────────────────────
echo ""
echo "[2] 인증 — 비로그인"
check "POST /auth/login (잘못된 자격증명) → 401" "401" \
  -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"bad","password":"bad"}'
check "GET  /auth/me 비인증 → 401"              "401" "$BASE_URL/api/auth/me"
check "POST /auth/refresh 쿠키 없음 → 401"      "401" \
  -X POST "$BASE_URL/api/auth/refresh" -H "Content-Type: application/json"

# ─── 3. 공공데이터 — 비인증 ──────────────────────────────────────────────────
echo ""
echo "[3] 공공데이터 — 비인증"
check "GET  /list"                      "200" "$BASE_URL/api/public-data/list?page=0&size=5"
check "GET  /stats"                     "200" "$BASE_URL/api/public-data/stats"
check "GET  /stats/data-items"          "200" "$BASE_URL/api/public-data/stats/data-items?sourceType=dataset"
check "GET  /detail/{listId}"           "200" "$BASE_URL/api/public-data/detail/$LIST_ID"
check "GET  /semantic?q=날씨"           "200" "$BASE_URL/api/public-data/semantic?q=$QUERY"
check "GET  /{listId}/similar"          "200" "$BASE_URL/api/public-data/$LIST_ID/similar"
check "GET  /data-items"                "200" "$BASE_URL/api/public-data/data-items?page=0&size=5"
check "GET  /data-items/{id}/similar"   "200" "$BASE_URL/api/public-data/data-items/$ENC_DATA_ITEM_ID/similar"
check "GET  /topics"                    "200" "$BASE_URL/api/public-data/topics"
check "GET  /topics/{id}/list"          "200" "$BASE_URL/api/public-data/topics/$TOPIC_ID/list"
check "GET  /related-terms?q=날씨"      "200" "$BASE_URL/api/public-data/related-terms?q=$QUERY"
check "GET  /embed-progress"            "200" "$BASE_URL/api/public-data/embed-progress"
check_ext "POST /invoke (외부 API)"     "200" \
  -X POST "$BASE_URL/api/public-data/invoke" \
  -H "Content-Type: application/json" \
  -d "{\"serviceKey\":\"test_key\",\"endpointUrl\":\"https://apis.data.go.kr/test\",\"params\":{}}"
check "POST /invoke SSRF 차단 → 400"   "400" \
  -X POST "$BASE_URL/api/public-data/invoke" \
  -H "Content-Type: application/json" \
  -d '{"serviceKey":"k","endpointUrl":"https://evil.com","params":{}}'

# ─── 4. 인증 — USER/ADMIN 레벨 ───────────────────────────────────────────────
echo ""
echo "[4] 인증 — USER 레벨 (admin 로그인)"
login "admin" "admin1234!"
[ -n "$JWT" ] && echo "  → 로그인 성공 (JWT 획득)" || echo "  ✗ 로그인 실패"

check "GET  /auth/me → 200"                    "200" "$BASE_URL/api/auth/me"
check     "GET  /public-data/my-subscriptions → 200" "200" "$BASE_URL/api/public-data/my-subscriptions"
check     "PATCH /auth/me/service-key → 200"         "200" \
  -X PATCH "$BASE_URL/api/auth/me/service-key" \
  -H "Content-Type: application/json" \
  -d '{"serviceKey":"smoke_test_key_temp"}'
check_ext "POST /{listId}/subscribe/manual (외부API)" "200" \
  -X POST "$BASE_URL/api/public-data/$LIST_ID/subscribe/manual"
check "POST /auth/logout → 200"                "200" \
  -X POST "$BASE_URL/api/auth/logout"
JWT=""

# ─── 5. 관리자 — 수집 ────────────────────────────────────────────────────────
echo ""
echo "[5] 관리자 — 수집"
login "admin" "admin1234!"
check     "GET  /admin/collect/status"          "200" "$BASE_URL/api/admin/collect/status"
check     "GET  /admin/collect/history"         "200" "$BASE_URL/api/admin/collect/history?limit=5"
check_ext "POST /admin/collect/stop (선행)"     "200" -X POST "$BASE_URL/api/admin/collect/stop"
check_ext "POST /admin/collect (외부 API)"      "202" -X POST "$BASE_URL/api/admin/collect"
check_ext "POST /admin/collect/stop"            "200" -X POST "$BASE_URL/api/admin/collect/stop"
check_ext "POST /admin/collect/resume"          "200" -X POST "$BASE_URL/api/admin/collect/resume"
check_ext "POST /admin/collect/stop (재중지)"   "200" -X POST "$BASE_URL/api/admin/collect/stop"
check_ext "POST /admin/collect/page/1"          "200" -X POST "$BASE_URL/api/admin/collect/page/1"
check_ext "POST /admin/collect/dataset"         "202" -X POST "$BASE_URL/api/admin/collect/dataset"
check_ext "POST /admin/collect/file-data"       "202" -X POST "$BASE_URL/api/admin/collect/file-data"
check_ext "POST /admin/collect/standard-data"   "202" -X POST "$BASE_URL/api/admin/collect/standard-data"
check     "POST /admin/ddl/generate-all → 202"  "202" -X POST "$BASE_URL/api/admin/ddl/generate-all"

# ─── 6. 관리자 — 스케줄러 ────────────────────────────────────────────────────
echo ""
echo "[6] 관리자 — 스케줄러"
SCHED=$(_curl "$BASE_URL/api/admin/scheduler")
check "GET  /admin/scheduler → 200"            "200" "$BASE_URL/api/admin/scheduler"
check "PUT  /admin/scheduler (현재값 유지)"    "200" \
  -X PUT "$BASE_URL/api/admin/scheduler" \
  -H "Content-Type: application/json" \
  -d "$SCHED"

# ─── 7. 관리자 — 사용자 CRUD ─────────────────────────────────────────────────
echo ""
echo "[7] 관리자 — 사용자 CRUD"
check "GET  /admin/users → 200" "200" "$BASE_URL/api/admin/users"

TEST_USER="smoke_$$"
CREATE_RESP=$(_curl -X POST "$BASE_URL/api/admin/users" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"Test1234!\",\"role\":\"USER\"}")
TEST_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -n "$TEST_ID" ]; then
  echo "  ✓ POST /admin/users — 생성 (id: $TEST_ID)"; PASS=$((PASS+1))
  check "PUT  /admin/users/{id}" "200" \
    -X PUT "$BASE_URL/api/admin/users/$TEST_ID" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"role\":\"USER\"}"
  check "PUT  /admin/users/{id}/password" "200" \
    -X PUT "$BASE_URL/api/admin/users/$TEST_ID/password" \
    -H "Content-Type: application/json" \
    -d '{"newPassword":"NewPass1234!"}'
  check "POST /admin/users/{id}/revoke-tokens" "200" \
    -X POST "$BASE_URL/api/admin/users/$TEST_ID/revoke-tokens"
  check "DELETE /admin/users/{id} → 200" "200" \
    -X DELETE "$BASE_URL/api/admin/users/$TEST_ID"
else
  echo "  ✗ POST /admin/users — 생성 실패: ${CREATE_RESP:0:100}"; FAIL=$((FAIL+1))
fi

logout

# ─── 8. 비인증 차단 확인 ─────────────────────────────────────────────────────
echo ""
echo "[8] 비인증 차단 확인"
check "GET  /admin/users 비인증 → 401"   "401" "$BASE_URL/api/admin/users"
check "POST /admin/collect 비인증 → 401" "401" -X POST "$BASE_URL/api/admin/collect"

# ─── 결과 ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "결과: ✓ $PASS 통과 / ✗ $FAIL 실패 / ⚠ $WARN 경고(외부API)"
echo "============================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
