import anthropic
import httpx
import json
import logging
from fastapi import APIRouter, HTTPException
logger = logging.getLogger(__name__)
from pydantic import BaseModel
from typing import Literal
from config import settings

router = APIRouter()

GITHUB_API = "https://api.github.com"

def _gh_headers():
    return {
        "Authorization": f"token {settings.github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

AREA_FILES = {
    "frontend": [
        "admin-portal/frontend/src/App.jsx",
        "admin-portal/frontend/src/Layout.jsx",
        "admin-portal/frontend/src/pages/Dashboard.jsx",
        "admin-portal/frontend/src/pages/Deploy.jsx",
        "admin-portal/frontend/src/pages/PRList.jsx",
        "admin-portal/frontend/src/pages/SecurityReports.jsx",
        "admin-portal/frontend/src/api.js",
    ],
    "backend": [
        "admin-portal/main.py",
        "admin-portal/routes/pr.py",
        "admin-portal/routes/security.py",
        "admin-portal/routes/deploy.py",
        "admin-portal/config.py",
        "admin-portal/models.py",
    ],
    "infra": [
        "admin-portal/Dockerfile",
        "Jenkinsfile",
        "Jenkinsfile.security",
    ],
}


class RequestInput(BaseModel):
    description: str
    request_type: Literal["추가", "수정", "삭제"]
    target_area: Literal["frontend", "backend", "infra", "both"]
    auto_deploy: bool = False


class ChangeItem(BaseModel):
    path: str
    action: Literal["create", "update", "delete"]
    content: str = ""
    description: str = ""


class ApplyInput(BaseModel):
    changes: list[ChangeItem]
    commit_message: str
    auto_deploy: bool = False


async def _fetch_file(path: str) -> dict | None:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{GITHUB_API}/repos/{settings.github_repo}/contents/{path}",
            headers=_gh_headers(),
        )
    if r.status_code != 200:
        return None
    import base64 as b64
    data = r.json()
    return {
        "path": path,
        "sha": data["sha"],
        "content": b64.b64decode(data["content"]).decode(errors="replace"),
    }


async def _get_file_sha(path: str) -> str | None:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{GITHUB_API}/repos/{settings.github_repo}/contents/{path}",
            headers=_gh_headers(),
        )
    if r.status_code != 200:
        return None
    return r.json().get("sha")


@router.post("/preview")
async def preview_changes(req: RequestInput):
    if not settings.claude_api_key:
        raise HTTPException(
            status_code=422,
            detail="CLAUDE_API_KEY가 설정되지 않았습니다. 서버 .env에 키를 추가해 주세요."
        )

    areas = ["frontend", "backend"] if req.target_area == "both" else [req.target_area]
    paths: list[str] = []
    for area in areas:
        paths.extend(AREA_FILES.get(area, []))

    import asyncio
    results = await asyncio.gather(*[_fetch_file(p) for p in paths], return_exceptions=True)
    files = [r for r in results if isinstance(r, dict)]

    files_text = "\n\n".join(
        f"=== {f['path']} ===\n{f['content'][:2500]}" for f in files
    )

    client = anthropic.Anthropic(api_key=settings.claude_api_key)
    system = (
        "You are an expert software engineer working on a FastAPI + React (Vite + Tailwind) admin portal. "
        "Given the current source files and the user request, produce a JSON array of file changes. "
        "Each item: {path, action (create|update|delete), content (full new file content for create/update, empty string for delete), description (Korean, 1 sentence)}. "
        "IMPORTANT: Return ONLY a valid JSON array. No markdown, no explanation."
    )
    user_msg = (
        f"요청 유형: {req.request_type}\n"
        f"요청 내용: {req.description}\n\n"
        f"현재 소스 파일:\n{files_text}"
    )

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
    )
    raw = message.content[0].text.strip()
    try:
        changes = json.loads(raw)
    except Exception as e:
        logger.warning('JSON parse failed, fallback to regex: %s', e)
        import re
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        changes = json.loads(m.group()) if m else []

    return {"changes": changes, "summary": f"{len(changes)}개 파일 변경 예정"}


@router.post("/apply")
async def apply_changes(req: ApplyInput):
    import base64 as b64
    results = []
    async with httpx.AsyncClient(timeout=15) as client:
        for change in req.changes:
            payload: dict = {
                "message": req.commit_message,
                "branch": "master",
            }
            if change.action in ("create", "update"):
                payload["content"] = b64.b64encode(change.content.encode()).decode()
                if change.action == "update":
                    sha = await _get_file_sha(change.path)
                    if sha:
                        payload["sha"] = sha
            elif change.action == "delete":
                sha = await _get_file_sha(change.path)
                if not sha:
                    results.append({"path": change.path, "status": "not_found"})
                    continue
                payload["sha"] = sha

            method = "delete" if change.action == "delete" else "put"
            r = await getattr(client, method)(
                f"{GITHUB_API}/repos/{settings.github_repo}/contents/{change.path}",
                headers=_gh_headers(),
                json=payload,
            )
            results.append({
                "path": change.path,
                "status": "ok" if r.status_code in (200, 201) else "error",
                "code": r.status_code,
            })

    if req.auto_deploy:
        try:
            from routes.deploy import trigger_deploy
            await trigger_deploy()
        except Exception as e:
            logger.error('apply_changes step failed: %s', e)

    return {"results": results, "deployed": req.auto_deploy}
