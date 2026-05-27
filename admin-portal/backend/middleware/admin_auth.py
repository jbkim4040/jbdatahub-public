"""관리자 인증 미들웨어 — API만 보호 + GUEST mutation 차단 + 역할 주입."""
import httpx
import logging
import os
import time
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

JBDATAHUB_URL = "https://jbdatahub.com"
INTERNAL_TOKEN = os.environ["INTERNAL_TOKEN"]  # WAS ↔ admin-portal: 환경변수 강제, 기본값 없음
ALLOWED_ROLES = {"ADMIN", "SUPER_ADMIN", "GUEST"}
MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

SKIP_PATHS = {"/api/health"}
SKIP_PREFIXES = ("/assets/", "/favicon", "/index.html")
SKIP_API_PREFIXES = ("/api/portal-login/",)
ALLOWED_MUTATION_PATHS = {"/api/auth/login", "/api/auth/logout"}

# token → (role, expiry_monotonic): /api/auth/me 호출 결과를 60초 캐시하여
# 매 요청마다 Spring Boot를 호출하는 레이턴시·장애 전파를 방지
_role_cache: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 60.0


def require_roles(*allowed: str):
    """라우트 레벨 역할 검증 Depends — middleware가 주입한 request.state.role 사용."""
    def _dep(request: Request) -> str:
        role = getattr(request.state, "role", None)
        if role not in allowed:
            label = "/".join(allowed)
            raise HTTPException(
                status_code=403,
                detail=f"이 작업은 {label} 권한이 필요합니다.",
            )
        return role
    return _dep


async def _resolve_role(token: str) -> str | None:
    now = time.monotonic()
    cached = _role_cache.get(token)
    if cached and now < cached[1]:
        return cached[0]

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(
                f"{JBDATAHUB_URL}/api/auth/me",
                cookies={"jb_token": token},
            )
        if r.status_code == 200:
            role = r.json().get("role")
            if role:
                _role_cache[token] = (role, now + _CACHE_TTL)
            return role
    except Exception as e:
        logger.warning(f"admin auth /me 위임 실패: {e}")
    return None


async def admin_auth_middleware(request: Request, call_next):
    path = request.url.path

    # UI(HTML)는 자유 통과 — API만 보호
    if not path.startswith("/api/"):
        return await call_next(request)
    if path in SKIP_PATHS or any(path.startswith(p) for p in SKIP_PREFIXES) or any(path.startswith(p) for p in SKIP_API_PREFIXES):
        return await call_next(request)

    # 서버간 호출 (WAS → admin-portal)
    if request.headers.get("x-internal-token") == INTERNAL_TOKEN:
        request.state.role = "SUPER_ADMIN"  # 내부 토큰은 최상위 권한으로 취급
        return await call_next(request)

    token = request.cookies.get("jb_token") or ""
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(None, 1)[1]

    role = await _resolve_role(token) if token else None

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

    # 역할을 request.state에 주입 → 라우트 핸들러에서 require_roles()로 검증 가능
    request.state.role = role

    return await call_next(request)
