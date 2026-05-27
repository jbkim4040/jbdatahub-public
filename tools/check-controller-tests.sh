#!/usr/bin/env bash
# Controller ↔ ControllerTest 1:1 대응 검사
# .test-skip에 등록된 컨트롤러는 검사 면제 (사유 주석 필수)
set -euo pipefail

SRC_ROOT="server/jbdatahub/src/main/java"
TEST_ROOT="server/jbdatahub/src/test/java"
SKIP_FILE="server/jbdatahub/.test-skip"

SKIP_LIST=()
if [[ -f "$SKIP_FILE" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    SKIP_LIST+=("$(echo "$line" | awk '{print $1}')")
  done < "$SKIP_FILE"
fi

MISSING=()
while IFS= read -r ctrl_path; do
  ctrl_name=$(basename "$ctrl_path" .java)
  # .test-skip에 있으면 건너뜀
  skip=false
  for s in "${SKIP_LIST[@]}"; do
    [[ "$s" == "$ctrl_name" ]] && skip=true && break
  done
  $skip && continue

  # 같은 패키지 경로에 *Test.java 존재 확인
  rel_path="${ctrl_path#$SRC_ROOT/}"
  test_path="$TEST_ROOT/${rel_path%Controller.java}ControllerTest.java"
  if [[ ! -f "$test_path" ]]; then
    MISSING+=("$ctrl_name → $test_path 없음")
  fi
done < <(find "$SRC_ROOT" -name "*Controller.java" | sort)

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "❌ Test Coverage Gate 실패: 테스트 파일 누락"
  for m in "${MISSING[@]}"; do echo "   - $m"; done
  echo ""
  echo "해결 방법:"
  echo "  1) 테스트 파일을 작성하거나"
  echo "  2) server/jbdatahub/.test-skip에 컨트롤러명과 사유를 추가하세요."
  exit 1
fi

echo "✅ Test Coverage Gate 통과: 모든 컨트롤러에 테스트가 존재합니다."
