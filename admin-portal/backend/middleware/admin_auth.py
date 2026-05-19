"""관리자 인증 미들웨어 — API만 보호 + GUEST mutation 차단."""
import httpx
import logging
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

JBDATAHUB_URL = "https://jbdatahub.com"
INTERNAL_TOKEN = "jb-internal-svc-token-2026"  # WAS ↔ admin-portal
ALLOWED_ROLES = {"ADMIN", "SUPER_ADMIN", "GUEST"}
MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

SKIP_PATHS = {"/api/health"}
SKIP_PREFIXES = ("/assets/", "/favicon", "/index.html")
SKIP_API_PREFIXES = ("/api/portal-login/",)
ALLOWED_MUTATION_PATHS = {"/api/auth/login", "/api/auth/logout"}


async def admin_auth_middleware(request: Request, call_next):
    path = request.url.path

    # UI(HTML)는 자유 통과 — API만 보호
    if not path.startswith("/api/"):
        return await call_next(request)
    if path in SKIP_PATHS or any(path.startswith(p) for p in SKIP_PREFIXES) or any(path.startswith(p) for p in SKIP_API_PREFIXES):
        return await call_next(request)

    # 서버간 호출 (WAS → admin-portal)
    if request.headers.get("x-internal-token") == INTERNAL_TOKEN:
        return await call_next(request)

    token = request.cookies.get("jb_token") or ""
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(None, 1)[1]

    role = None
    if token:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
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
             "message": "관리자(ADMIN/SUPER_ADMIN/GUEST) 권한 필요" if role
                        else "로그인이 필요합니다. https://jbdatahub.com/login"},
            status_code=status,
        )

    # GUEST는 mutation 차단
    if role == "GUEST" and request.method in MUTATION_METHODS and path not in ALLOWED_MUTATION_PATHS:
        return JSONResponse(
            {"error": "guest_readonly", "message": "게스트 계정은 데이터 변경 권한이 없습니다."},
            status_code=403,
        )

    return await call_next(request)
