"""data.go.kr Playwright SSO 자동 로그인 (카카오/네이버 OAuth + 일반 CAPTCHA)."""
import asyncio
import base64 as _b64
import logging
import secrets
import time as _time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter()

_pending: dict[str, dict] = {}  # token → session state
PENDING_TTL = 600  # 10분 (2FA 대기 고려)


def _gc():
    now = _time.time()
    for k in list(_pending.keys()):
        if _pending[k].get("expires_at", 0) < now:
            _pending.pop(k, None)


async def _screenshot_b64(page) -> str:
    """현재 페이지 viewport 스크린샷 → base64 PNG."""
    png = await page.screenshot(full_page=False, type="png")
    return "data:image/png;base64," + _b64.b64encode(png).decode()


async def _save_cookies(context, username: str) -> dict:
    """data.go.kr 세션 cookie를 DB에 저장."""
    cookies = await context.cookies()
    # data.go.kr 도메인 cookie만 추출
    cookie_jar = "; ".join(
        f"{c['name']}={c['value']}" for c in cookies
        if "data.go.kr" in c.get("domain", "")
    )
    if not cookie_jar:
        raise HTTPException(502, "data.go.kr cookie 없음 — 로그인 실패 추정")

    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE data_portal_session SET valid=false WHERE valid=true")
        await conn.execute(
            """INSERT INTO data_portal_session
               (label, cookie_jar, user_name, expires_at, valid)
               VALUES ($1, $2, $3, $4, true)""",
            f"playwright-{datetime.now().strftime('%Y%m%d-%H%M')}",
            cookie_jar, username, expires,
        )
    return {"ok": True, "user": username, "expires_at": expires.isoformat()}


# ─── 일반 CAPTCHA 로그인 ──────────────────────────────────

@router.post("/prepare")
async def prepare():
    """일반 ID/PW + CAPTCHA 로그인 페이지 진입."""
    from playwright.async_api import async_playwright

    _gc()
    p = await async_playwright().start()
    browser = await p.chromium.launch(
        headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    )
    try:
        context = await browser.new_context(
            locale="ko-KR",
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        await page.goto("https://www.data.go.kr/uim/login/loginView.do",
                        wait_until="domcontentloaded", timeout=25000)
        captcha_el = await page.query_selector('img[src*="/captcha"]')
        if not captcha_el:
            raise HTTPException(502, "CAPTCHA element not found")
        captcha_bytes = await captcha_el.screenshot()
        token = secrets.token_urlsafe(24)
        _pending[token] = {
            "kind": "captcha", "p": p, "browser": browser,
            "context": context, "page": page,
            "expires_at": _time.time() + PENDING_TTL,
        }
        return {"token": token, "captcha": "data:image/png;base64," + _b64.b64encode(captcha_bytes).decode(), "ttl": PENDING_TTL}
    except Exception as e:
        await browser.close(); await p.stop()
        raise HTTPException(502, f"prepare failed: {e}") if not isinstance(e, HTTPException) else e


@router.post("/submit")
async def submit(payload: dict):
    """CAPTCHA 폼 제출."""
    token = payload.get("token", "")
    username = payload.get("username", "").strip()
    password = payload.get("password", "")
    captcha = payload.get("captcha", "").strip()
    if not all([token, username, password, captcha]):
        raise HTTPException(400, "token/username/password/captcha 필수")
    _gc()
    entry = _pending.get(token)
    if not entry or entry.get("kind") != "captcha":
        raise HTTPException(410, "token 만료/무효")
    page, browser, p, context = entry["page"], entry["browser"], entry["p"], entry["context"]
    try:
        await page.fill('input[name="username"]', username)
        await page.fill('input[name="password"]', password)
        await page.fill('input[name="captcha"]', captcha)
        await page.click('button[type="submit"], button:has-text("로그인")', timeout=10000)
        try: await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception: pass
        if "common-login" in page.url:
            err_el = await page.query_selector(".alert-danger, .text-danger")
            err = (await err_el.inner_text() if err_el else "로그인 실패")[:200]
            raise HTTPException(401, f"로그인 실패: {err}")
        return await _save_cookies(context, username)
    finally:
        await browser.close(); await p.stop()
        _pending.pop(token, None)


# ─── 카카오 OAuth 로그인 ──────────────────────────────────

@router.post("/kakao/start")
async def kakao_start():
    """카카오 OAuth: data.go.kr → 카카오 로그인 페이지까지 진입 + 현 화면 screenshot."""
    from playwright.async_api import async_playwright

    _gc()
    p = await async_playwright().start()
    browser = await p.chromium.launch(
        headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    )
    try:
        context = await browser.new_context(
            locale="ko-KR",
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
            viewport={"width": 480, "height": 720},
        )
        page = await context.new_page()
        await page.goto("https://www.data.go.kr/uim/login/loginView.do",
                        wait_until="domcontentloaded", timeout=25000)

        # 카카오 OAuth 직접 진입 (data.go.kr 페이지에서 카카오 SSO 버튼이 javascript redirect라서)
        kakao_url = (
            "https://kauth.kakao.com/oauth/authorize?response_type=code"
            "&client_id=d03e021cb31c4dd3c15c10d2767c8723"
            "&redirect_uri=https%3A%2F%2Fauth.data.go.kr%2Fsso%2Fauth%2Fk%2Fcallback"
        )
        await page.goto(kakao_url, wait_until="domcontentloaded", timeout=25000)
        await asyncio.sleep(1.5)
        shot = await _screenshot_b64(page)
        token = secrets.token_urlsafe(24)
        _pending[token] = {
            "kind": "kakao", "p": p, "browser": browser,
            "context": context, "page": page,
            "expires_at": _time.time() + PENDING_TTL,
            "stage": "login",
        }
        return {"token": token, "screenshot": shot, "stage": "login", "ttl": PENDING_TTL}
    except Exception as e:
        await browser.close(); await p.stop()
        raise HTTPException(502, f"kakao_start failed: {e}")


@router.post("/kakao/submit")
async def kakao_submit(payload: dict):
    """카카오 ID/PW 입력 → 결과(성공/2FA/실패) 반환."""
    token = payload.get("token", "")
    kakao_id = payload.get("kakao_id", "").strip()
    kakao_pw = payload.get("kakao_pw", "")
    data_portal_user = payload.get("user_label", "kakao_user").strip()
    if not all([token, kakao_id, kakao_pw]):
        raise HTTPException(400, "token/kakao_id/kakao_pw 필수")
    _gc()
    entry = _pending.get(token)
    if not entry or entry.get("kind") != "kakao":
        raise HTTPException(410, "token 만료/무효")
    page, browser, p, context = entry["page"], entry["browser"], entry["p"], entry["context"]

    try:
        # 카카오 로그인 폼 입력
        # input name="email"/"loginId" 등 케이스 대응
        for sel in ['input[name="loginId"]', 'input[name="email"]', 'input#loginId--1', 'input[type="email"]', 'input[name*="id"]']:
            el = await page.query_selector(sel)
            if el:
                await el.fill(kakao_id); break
        for sel in ['input[name="password"]', 'input[type="password"]', 'input#password--2']:
            el = await page.query_selector(sel)
            if el:
                await el.fill(kakao_pw); break
        # 로그인 버튼
        for sel in ['button[type="submit"]', 'button.btn_g.highlight', 'button:has-text("로그인")']:
            el = await page.query_selector(sel)
            if el:
                await el.click(); break

        await asyncio.sleep(3)
        try: await page.wait_for_load_state("networkidle", timeout=20000)
        except Exception: pass

        url = page.url
        # 콜백 도착 확인
        if "data.go.kr" in url and "callback" not in url and "login" not in url.lower():
            # 동의 페이지가 따로 있으면 동의 버튼 클릭
            agree = await page.query_selector('button.btn_agree, button:has-text("동의"), button:has-text("계속")')
            if agree:
                await agree.click()
                await asyncio.sleep(2)
            return await _finalize_kakao(token, data_portal_user)

        # 동의 페이지인 경우
        if "kakao.com" in url and ("consent" in url or "scope" in url or "agree" in url):
            agree = await page.query_selector('button:has-text("동의하고 계속"), button[type="submit"]')
            if agree:
                await agree.click()
                await asyncio.sleep(3)
                try: await page.wait_for_load_state("networkidle", timeout=15000)
                except Exception: pass
                if "data.go.kr" in page.url:
                    return await _finalize_kakao(token, data_portal_user)

        # 2FA / 추가 인증 화면 — screenshot 반환
        shot = await _screenshot_b64(page)
        entry["stage"] = "2fa"
        # 명시적 키워드 감지
        body = (await page.content() or "")[:5000]
        need = "추가 인증 필요"
        for kw in ["인증번호", "휴대폰", "카카오톡으로 인증", "기기 인증", "OTP"]:
            if kw in body:
                need = f"카카오 추가 인증 필요: {kw}"; break
        return {"token": token, "stage": "2fa", "screenshot": shot, "message": need}

    except Exception as e:
        await browser.close(); await p.stop()
        _pending.pop(token, None)
        raise HTTPException(502, f"kakao_submit failed: {e}")


async def _finalize_kakao(token: str, user_label: str):
    entry = _pending.get(token)
    if not entry:
        raise HTTPException(410, "token lost")
    try:
        result = await _save_cookies(entry["context"], user_label)
        return result
    finally:
        try: await entry["browser"].close()
        except Exception: pass
        try: await entry["p"].stop()
        except Exception: pass
        _pending.pop(token, None)


@router.post("/kakao/continue")
async def kakao_continue(payload: dict):
    """2FA 완료 후 사용자가 '계속' 클릭 시 다음 페이지로 진행 + 결과 확인."""
    token = payload.get("token", "")
    user_label = payload.get("user_label", "kakao_user").strip()
    if not token:
        raise HTTPException(400, "token 필수")
    _gc()
    entry = _pending.get(token)
    if not entry:
        raise HTTPException(410, "token 만료/무효")
    page = entry["page"]
    try:
        await asyncio.sleep(2)
        try: await page.wait_for_load_state("networkidle", timeout=10000)
        except Exception: pass
        url = page.url
        if "data.go.kr" in url:
            return await _finalize_kakao(token, user_label)
        # 또 다른 단계면 screenshot 반환
        shot = await _screenshot_b64(page)
        return {"token": token, "stage": "2fa", "screenshot": shot, "message": "아직 카카오 인증 페이지에 있음"}
    except Exception as e:
        raise HTTPException(502, f"continue failed: {e}")


@router.get("/status")
async def status():
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
