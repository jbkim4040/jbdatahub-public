#!/bin/bash
# jb-workspace 배포 후 스모크 테스트
# 사용법: bash scripts/smoke-test.sh [BASE_URL]
# 기본값: https://localhost (앱 서버 내부 실행 기준)

BASE_URL="${1:-https://localhost}"
PASS=0; FAIL=0

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

echo "=== jb-workspace 스모크 테스트 ($(date '+%Y-%m-%d %H:%M:%S')) ==="
echo "대상: $BASE_URL"
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
