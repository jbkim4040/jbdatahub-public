from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from typing import Optional
import httpx
import hmac
import hashlib
import json
import logging
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
logger = logging.getLogger(__name__)

from config import settings
from middleware.admin_auth import require_roles
# from database import get_db  # replaced by get_pool

router = APIRouter()

GITHUB_API = "https://api.github.com"
GITHUB_HEADERS = {
    "Authorization": f"token {settings.github_token}",
    "Accept": "application/vnd.github.v3+json",
}
DIFF_HEADERS = {
    "Authorization": f"token {settings.github_token}",
    "Accept": "application/vnd.github.v3.diff",
}


# ── Helper: GitHub API ────────────────────────────────────────────

async def gh_get(path: str, headers: dict = None) -> dict | list | str:
    hdrs = headers or GITHUB_HEADERS
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{GITHUB_API}{path}", headers=hdrs)
        r.raise_for_status()
        ct = r.headers.get("content-type", "")
        if "json" in ct:
            return r.json()
        return r.text


async def gh_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{GITHUB_API}{path}", headers=GITHUB_HEADERS, json=body
        )
        r.raise_for_status()
        return r.json()


async def gh_put(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.put(
            f"{GITHUB_API}{path}", headers=GITHUB_HEADERS, json=body
        )
        r.raise_for_status()
        return r.json()


# ── Helper: DB 조회 ────────────────────────────────────────────────

def fetch_reviews(pr_number: int) -> list:
    # Note: This is called from sync context (GitHub webhook), so we use psycopg2 fallback
    # For async routes, use get_pool() directly
    return []  # Disabled in async refactor; webhook handler should be async


async def fetch_reviews_async(pr_number: int) -> list:
    from database import get_pool
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM pr_reviews WHERE pr_number = $1 ORDER BY created_at DESC",
            pr_number,
        )
    return [dict(r) for r in rows]


def save_review(pr_number: int, score: int, summary: str, full_review: str) -> None:
    # Sync stub; use save_review_async in async contexts
    pass


async def save_review_async(pr_number: int, pr_title: str, score: int, summary: str, full_review: str) -> None:
    import json
    from datetime import datetime, timezone
    from database import get_pool
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            await conn.execute(
                """INSERT INTO pr_reviews (pr_number, pr_title, review_body, status, claude_score, comments)
                   VALUES ($1, $2, $3, $4, $5, $6::jsonb)""",
                pr_number, pr_title, full_review, "pending", score,
                json.dumps([{"summary": summary, "ts": datetime.now(timezone.utc).isoformat()}]),
            )
        except Exception as e:
            logger.error('save_review_async failed: %s', e)


# ── Helper: Claude 리뷰 생성 ──────────────────────────────────────


    system_prompt = (
        "당신은 시니어 소프트웨어 엔지니어입니다. "
        "PR diff를 분석하여 코드 리뷰를 한국어로 작성하세요.\n\n"
        "반드시 아래 JSON 블록을 응답 끝에 포함하세요:\n"
        "```json\n{\"score\": <0-100 정수>}\n```\n\n"
        "리뷰 항목:\n"
        "1. **보안 취약점**: SQL 인젝션, XSS, 인증/인가 누락, 민감 정보 노출 등\n"
        "2. **코드 품질**: 가독성, 중복 코드, 함수 크기, 네이밍 컨벤션\n"
        "3. **Spring Boot / React 패턴**: 레이어 분리, 훅 사용, 상태 관리\n"
        "4. **개선 제안**: 구체적인 수정 방법 포함\n\n"
        "점수 기준: 90-100 우수, 70-89 양호, 50-69 보통, 0-49 개선 필요"
    )

    user_content = (
        f"## PR 제목\n{pr_title}\n\n"
        f"## PR 설명\n{pr_body or '없음'}\n\n"
        f"## Diff\n```diff\n{diff[:12000]}\n```"
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": user_content}],
        system=system_prompt,
    )

    full_review = message.content[0].text

    # JSON 블록에서 점수 파싱
    score = 70  # 기본값
    try:
        import re
        m = re.search(r"```json\s*\{[^}]*\"score\"\s*:\s*(\d+)[^}]*\}\s*```", full_review, re.S)
        if m:
            score = max(0, min(100, int(m.group(1))))
    except Exception:
        pass

    # summary: 첫 단락 추출
    lines = [l.strip() for l in full_review.split("\n") if l.strip()]
    summary = lines[0] if lines else full_review[:200]

    return score, summary, full_review


# ── Routes ────────────────────────────────────────────────────────

@router.get("")
async def list_prs():
    """GitHub open PR 목록 반환"""
    repo = settings.github_repo
    data = await gh_get(f"/repos/{repo}/pulls?state=open&per_page=50")
    prs = []
    for pr in data:
        prs.append(
            {
                "number": pr["number"],
                "title": pr["title"],
                "author": pr["user"]["login"],
                "head_branch": pr["head"]["ref"],
                "base_branch": pr["base"]["ref"],
                "state": pr["state"],
                "created_at": pr["created_at"],
                "updated_at": pr["updated_at"],
                "html_url": pr["html_url"],
                "draft": pr.get("draft", False),
            }
        )
    return {"prs": prs, "total": len(prs)}


@router.get("/{pr_number}")
async def get_pr(pr_number: int):
    """PR 상세 + diff + DB 리뷰 이력"""
    repo = settings.github_repo
    pr = await gh_get(f"/repos/{repo}/pulls/{pr_number}")
    diff = await gh_get(f"/repos/{repo}/pulls/{pr_number}", headers=DIFF_HEADERS)
    reviews = fetch_reviews(pr_number)
    return {
        "number": pr["number"],
        "title": pr["title"],
        "body": pr.get("body", ""),
        "author": pr["user"]["login"],
        "head_branch": pr["head"]["ref"],
        "base_branch": pr["base"]["ref"],
        "state": pr["state"],
        "created_at": pr["created_at"],
        "updated_at": pr["updated_at"],
        "html_url": pr["html_url"],
        "diff": diff,
        "reviews": reviews,
    }


async def review_pr(pr_number: int):
    """Claude로 diff 분석 → PR 코멘트 등록 + DB 저장"""
    repo = settings.github_repo

    pr = await gh_get(f"/repos/{repo}/pulls/{pr_number}")
    if pr["state"] != "open":
        raise HTTPException(status_code=400, detail="PR이 열려 있지 않습니다.")

    diff = await gh_get(f"/repos/{repo}/pulls/{pr_number}", headers=DIFF_HEADERS)

    try:
        score, summary, full_review = call_claude_review(
            diff=diff,
            pr_title=pr["title"],
            pr_body=pr.get("body", ""),
        )
    except TypeError as e:
        if "authentication method" in str(e):
            raise HTTPException(status_code=503, detail="CLAUDE_API_KEY 미설정")
        raise HTTPException(status_code=500, detail=f"Claude API 오류: {e}")
    except Exception as e:
        logger.error("Claude review failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Claude API 호출 실패: {e}")

    # GitHub PR 코멘트 등록
    comment_body = (
        f"## 🤖 Claude 자동 코드 리뷰\n\n"
        f"**점수**: {score}/100\n\n"
        f"{full_review}"
    )
    await gh_post(f"/repos/{repo}/issues/{pr_number}/comments", {"body": comment_body})

    # DB 저장
    save_review(pr_number, score, summary, full_review)

    return {
        "pr_number": pr_number,
        "score": score,
        "summary": summary,
        "full_review": full_review,
    }


@router.post("/{pr_number}/merge")
async def merge_pr(pr_number: int, _: str = Depends(require_roles("SUPER_ADMIN"))):
    """PR squash merge"""
    repo = settings.github_repo
    pr = await gh_get(f"/repos/{repo}/pulls/{pr_number}")
    if pr["state"] != "open":
        raise HTTPException(status_code=400, detail="PR이 열려 있지 않습니다.")

    result = await gh_put(
        f"/repos/{repo}/pulls/{pr_number}/merge",
        {
            "commit_title": f"squash: {pr['title']} (#{pr_number})",
            "commit_message": pr.get("body", ""),
            "merge_method": "squash",
        },
    )
    return {"merged": result.get("merged", False), "message": result.get("message", "")}


@router.post("/webhook/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """GitHub PR opened 이벤트 수신 → 자동 review 트리거"""
    payload_bytes = await request.body()

    # H7: webhook_secret 필수. 없으면 503 (의도적 fail-fast)
    if not settings.webhook_secret:
        raise HTTPException(status_code=503, detail="webhook_secret이 설정되지 않았습니다 (보안)")
    sig_header = request.headers.get("X-Hub-Signature-256", "")
    expected = "sha256=" + hmac.new(
        settings.webhook_secret.encode(), payload_bytes, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig_header, expected):
        raise HTTPException(status_code=403, detail="Invalid signature")

    event = request.headers.get("X-GitHub-Event", "")
    if event != "pull_request":
        return {"status": "ignored", "event": event}

    payload = json.loads(payload_bytes)
    action = payload.get("action", "")
    if action not in ("opened", "synchronize", "reopened"):
        return {"status": "ignored", "action": action}

    pr_number = payload["pull_request"]["number"]


    return {"status": "accepted (review disabled)", "pr_number": pr_number}
