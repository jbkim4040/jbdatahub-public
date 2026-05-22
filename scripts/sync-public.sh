#!/bin/bash
# jb-workspace master → jbdatahub-public main 일일 미러링

set -e

PAT="${GH_PAT:?GH_PAT environment variable is required}"
PRIVATE_REPO="https://jbkim4040:${PAT}@github.com/jbkim4040/jb-workspace.git"
PUBLIC_REPO="https://jbkim4040:${PAT}@github.com/jbkim4040/jbdatahub-public.git"
WORK_DIR="/tmp/jb-mirror-$$"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 미러링 시작"

git clone --bare "$PRIVATE_REPO" "$WORK_DIR"
cd "$WORK_DIR"
git push "$PUBLIC_REPO" refs/heads/master:refs/heads/main --force

cd /
rm -rf "$WORK_DIR"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 미러링 완료"
