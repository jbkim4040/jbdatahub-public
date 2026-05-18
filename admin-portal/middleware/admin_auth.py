"""관리자 인증 미들웨어 — API만 보호. UI는 자유 (클라이언트에서 401 처리)."""
import httpx
import logging
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

JBDATAHUB_URL = "https://jbdatahub.com"
ALLOWED_ROLES = {"ADMIN", "SUPER_ADMIN"}

# 인증 우회: 정적, 헬스, 그리고 UI 라우트 (SPA가 직접 처리)
SKIP_PATHS = {"/api/health"}
SKIP_API_PREFIXES = ("/api/portal-login/",)  # 카카오/CAPTCHA 로그인은 미인증 접근 (data.go.kr 인증 흐름)
SKIP_PREFIXES = ("/assets/", "/favicon", "/index.html")


async def admin_auth_middleware(request: Request, call_next):
    path = request.url.path

    # UI(HTML)는 자유 통과 — API만 보호
    if not path.startswith("/api/"):
        return await call_next(request)
    if path in SKIP_PATHS or any(path.startswith(p) for p in SKIP_PREFIXES) or any(path.startswith(p) for p in SKIP_API_PREFIXES):
        return await call_next(request)

    token = request.cookies.get("jb_token") or ""
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(None, 1)[1]

    role = None
    if token:
        try:
            async with httpx.AsyncClient(timeout=3.0, verify=False) as client:
                r = await client.get(
                    f"{JBDATAHUB_URL}/api/auth/me",
                    cookies={"jb_token": token},
                )
            if r.status_code == 200:
                role = r.json().get("role")
        except Exception as e:
            logger.warning(f"admin auth /me 위임 실패: {e}")

    if role not in ALLOWED_ROLES:
        status = 403 if role else 401
        return JSONResponse(
            {"error": "forbidden" if role else "unauthorized",
             "message": "관리자(ADMIN/SUPER_ADMIN) 권한 필요" if role
                        else "로그인이 필요합니다. https://jbdatahub.com/login"},
            status_code=status,
        )

    return await call_next(request)
