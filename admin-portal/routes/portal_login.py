"""data.go.kr Playwright SSO 자동 로그인 (CAPTCHA 반자동) — 별도 라우터."""
import base64 as _b64
import secrets
import time as _time
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter()

_pending: dict[str, dict] = {}
PENDING_TTL = 300  # 5분


def _gc():
    now = _time.time()
    for k in list(_pending.keys()):
        if _pending[k].get("expires_at", 0) < now:
            _pending.pop(k, None)


@router.post("/prepare")
async def prepare():
    """Playwright로 로그인 페이지 진입 → CAPTCHA + CSRF 반환."""
    from playwright.async_api import async_playwright

    _gc()
    p = await async_playwright().start()
    browser = await p.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    )
    try:
        context = await browser.new_context(
            locale="ko-KR",
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        await page.goto(
            "https://www.data.go.kr/uim/login/loginView.do",
            wait_until="domcontentloaded",
            timeout=25000,
        )
        csrf = await page.input_value('input[name="_csrf"]')
        captcha_el = await page.query_selector('img[src*="/captcha"]')
        if not captcha_el:
            raise HTTPException(502, "CAPTCHA element not found")
        captcha_bytes = await captcha_el.screenshot()
        captcha_b64 = "data:image/png;base64," + _b64.b64encode(captcha_bytes).decode()

        token = secrets.token_urlsafe(24)
        _pending[token] = {
            "p": p,
            "browser": browser,
            "context": context,
            "page": page,
            "csrf": csrf,
            "expires_at": _time.time() + PENDING_TTL,
        }
        return {"token": token, "captcha": captcha_b64, "ttl": PENDING_TTL}
    except Exception as e:
        try:
            await browser.close()
        finally:
            await p.stop()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(502, f"prepare failed: {e}")


@router.post("/submit")
async def submit(payload: dict):
    """ID/PW/CAPTCHA + token → 로그인 → cookie DB 저장."""
    token = payload.get("token", "")
    username = payload.get("username", "").strip()
    password = payload.get("password", "")
    captcha = payload.get("captcha", "").strip()
    if not all([token, username, password, captcha]):
        raise HTTPException(400, "token/username/password/captcha 필수")

    _gc()
    entry = _pending.get(token)
    if not entry:
        raise HTTPException(410, "token 만료 또는 무효 — 다시 prepare 호출")

    page = entry["page"]
    browser = entry["browser"]
    p = entry["p"]
    context = entry["context"]
    try:
        await page.fill('input[name="username"]', username)
        await page.fill('input[name="password"]', password)
        await page.fill('input[name="captcha"]', captcha)
        # 제출
        await page.click('button[type="submit"], button:has-text("로그인")', timeout=10000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass

        final_url = page.url
        if "common-login" in final_url:
            # 실패 메시지 추출
            err_msg = ""
            for sel in [".alert-danger", ".error-message", ".text-danger", "p.text-danger"]:
                el = await page.query_selector(sel)
                if el:
                    err_msg = (await el.inner_text() or "").strip()
                    if err_msg:
                        break
            raise HTTPException(401, f"로그인 실패: {err_msg or '아이디/비밀번호/보안문자 확인'}")

        # 세션 cookie 수집
        cookies = await context.cookies()
        cookie_jar = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
        if not cookie_jar:
            raise HTTPException(502, "cookie 없음 — 로그인 실패")

        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute("UPDATE data_portal_session SET valid=false WHERE valid=true")
            await conn.execute(
                """INSERT INTO data_portal_session
                   (label, cookie_jar, user_name, expires_at, valid)
                   VALUES ($1, $2, $3, $4, true)""",
                f"playwright-{datetime.now().strftime('%Y%m%d-%H%M')}",
                cookie_jar,
                username,
                expires,
            )
        logger.info(f"data.go.kr 자동 로그인 성공: {username}")
        return {"ok": True, "user": username, "expires_at": expires.isoformat()}
    finally:
        try:
            await browser.close()
        except Exception:
            pass
        try:
            await p.stop()
        except Exception:
            pass
        _pending.pop(token, None)


@router.get("/status")
async def status():
    """현재 보유 중인 data.go.kr 세션 정보."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT label, user_name, created_at, expires_at, last_used, valid
               FROM data_portal_session WHERE valid=true
               ORDER BY created_at DESC LIMIT 1"""
        )
    if not row:
        return {"valid": False}
    d = dict(row)
    for k in ("created_at", "expires_at", "last_used"):
        if d.get(k):
            d[k] = d[k].isoformat()
    return d
