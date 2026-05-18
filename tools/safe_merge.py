#!/usr/bin/env python3
"""Application-level branch protection wrapper.

PR 머지 전 Multi-Agent PR Review status check 통과 확인.
emergency 라벨 PR은 skip (cherry-pick hotfix용).

사용:
    python3 tools/safe_merge.py <PR_NUMBER>
    python3 tools/safe_merge.py <PR_NUMBER> --emergency  # 우회

환경변수:
    GH_TOKEN — GitHub PAT (필수)
    REPO     — owner/name (기본 jbkim4040/jb-workspace)
"""
import argparse, json, os, sys, time
import urllib.request, urllib.error

REPO = os.environ.get("REPO", "jbkim4040/jb-workspace")
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
TIMEOUT_MIN = int(os.environ.get("MERGE_TIMEOUT_MIN", "10"))
REQUIRED_CHECK = "Multi-Agent PR Review"


def gh(method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        data=json.dumps(body).encode() if body else None,
        headers={
            "Authorization": f"token {TOKEN}",
            "Accept": "application/vnd.github.v3+json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"{method} {path} → {e.code}: {e.read().decode()[:300]}\n")
        raise


def get_pr(n: int) -> dict:
    return gh("GET", f"/repos/{REPO}/pulls/{n}")


def has_emergency_label(pr: dict) -> bool:
    return any(l["name"].lower() in ("emergency", "hotfix", "urgent") for l in pr.get("labels", []))


def wait_for_check(head_sha: str, timeout_min: int = TIMEOUT_MIN) -> str:
    """Returns 'success' / 'failure' / 'timeout' / 'missing'."""
    deadline = time.time() + timeout_min * 60
    while time.time() < deadline:
        checks = gh("GET", f"/repos/{REPO}/commits/{head_sha}/check-runs?per_page=100")
        ma = next((c for c in checks.get("check_runs", []) if REQUIRED_CHECK in c["name"]), None)
        if not ma:
            sys.stderr.write(f"  대기 중… ({REQUIRED_CHECK} check 아직 시작 안 됨)\n")
        elif ma["status"] == "completed":
            return ma["conclusion"]
        else:
            sys.stderr.write(f"  진행 중: {ma['status']}\n")
        time.sleep(30)
    return "timeout"


def merge_pr(n: int, title: str | None = None) -> dict:
    return gh("PUT", f"/repos/{REPO}/pulls/{n}/merge", {
        "commit_title": title or f"PR #{n}",
        "merge_method": "squash",
    })


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pr", type=int, help="PR number")
    parser.add_argument("--emergency", action="store_true",
                        help="Multi-Agent check 우회 (cherry-pick hotfix)")
    args = parser.parse_args()

    if not TOKEN:
        sys.stderr.write("GH_TOKEN 환경변수 필요\n")
        return 2

    pr = get_pr(args.pr)
    sys.stderr.write(f"PR #{args.pr}: {pr['title']}\n")

    emergency = args.emergency or has_emergency_label(pr)
    if emergency:
        sys.stderr.write("🚨 EMERGENCY — Multi-Agent skip + 즉시 머지\n")
        result = merge_pr(args.pr, pr["title"])
        print(json.dumps(result))
        return 0

    head_sha = pr["head"]["sha"]
    sys.stderr.write(f"Multi-Agent check 대기 (최대 {TIMEOUT_MIN}분)…\n")
    outcome = wait_for_check(head_sha)
    sys.stderr.write(f"결과: {outcome}\n")

    if outcome == "success":
        result = merge_pr(args.pr, pr["title"])
        print(json.dumps(result))
        return 0
    elif outcome == "failure":
        sys.stderr.write("❌ Multi-Agent 거절 — 머지 안 함. --emergency 우회 가능.\n")
        return 1
    elif outcome == "timeout":
        sys.stderr.write(f"⏱️ Multi-Agent timeout ({TIMEOUT_MIN}분) — 머지 안 함.\n")
        return 1
    else:
        sys.stderr.write(f"❓ Multi-Agent missing — Branch Protection 우회 가능성. --emergency 사용.\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
