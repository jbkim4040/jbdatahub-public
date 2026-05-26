#!/bin/bash
# jb-workspace master → jbdatahub-public main 일일 미러링
#
# Requires:
#   - GH_PAT: GitHub Personal Access Token (env var)
#   - git-filter-repo: brew install git-filter-repo
#
# History 내 노출된 PAT는 filter-repo 로 제거 후 public push.
# (private repo 의 과거 커밋 4c45eff... 에 PAT 가 하드코딩되어 있으나
#  히스토리 rewrite 위험성 때문에 private 은 그대로 두고 mirror 단계에서만 제거)

set -e

PAT="${GH_PAT:?GH_PAT environment variable is required}"
PRIVATE_REPO="https://jbkim4040:${PAT}@github.com/jbkim4040/jb-workspace.git"
PUBLIC_REPO="https://jbkim4040:${PAT}@github.com/jbkim4040/jbdatahub-public.git"
WORK_DIR="/tmp/jb-mirror-$$"
SECRETS_FILE="/tmp/jb-mirror-secrets-$$.txt"

cleanup() {
    cd /
    rm -rf "$WORK_DIR" "$SECRETS_FILE"
}
trap cleanup EXIT

if ! command -v git-filter-repo >/dev/null 2>&1; then
    echo "ERROR: git-filter-repo not installed. Run: brew install git-filter-repo" >&2
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 미러링 시작"

git clone --bare "$PRIVATE_REPO" "$WORK_DIR"
cd "$WORK_DIR"

# Public 푸시 전에 히스토리에서 알려진 노출 PAT 를 제거
# (regex literal — 새 PAT 가 노출되면 아래에 한 줄씩 추가)
cat > "$SECRETS_FILE" <<'SECRETS'
GH_PAT_REDACTED==>GH_PAT_REDACTED
SECRETS

git filter-repo --replace-text "$SECRETS_FILE" --force >/dev/null

git push "$PUBLIC_REPO" refs/heads/master:refs/heads/main --force
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 미러링 완료"
