"""공공데이터포털 (data.go.kr) API 사용신청 자동화.

흐름:
  1. 사용자가 브라우저로 data.go.kr 로그인 후 cookie 등록
  2. POST /request — 큐에 추가, 백그라운드 worker가 자동 제출
     a. 상세 페이지 GET → publicDataDetailPk(uddi) 추출
     b. 신청 폼 페이지 GET → oprtinAuthorList(operation seq) 추출
     c. POST /iim/api/saveDevAcountRequest.do — 실제 신청
  3. 마이페이지 polling — 승인/거절 추적, API 키 추출
"""
import json
import logging
import re
from datetime import datetime, timezone
from typing import Literal, Optional

import httpx
from http.cookies import SimpleCookie
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter()

DATA_PORTAL_BASE = "https://www.data.go.kr"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"

# 활용목적 코드 (data.go.kr 분류)
PURPOSE_CODES = {
    "WEB":      "PROS01",  # 웹사이트
    "APP":      "PROS02",  # 앱개발
    "RESEARCH": "PROS03",  # 연구
    "OTHER":    "PROS04",  # 기타
}


# ────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────
class SessionUpdate(BaseModel):
    cookie_jar: str
    user_name: Optional[str] = None
    label: str = "default"


class SubscriptionRequest(BaseModel):
    list_id: str
    detail_pk: Optional[str] = None       # 명시하면 그것 사용, 없으면 페이지 첫 번째
    operation_seq: Optional[int] = None
    usage_purpose: str = "jb-workspace 통합 데이터 허브 운영 - 공공데이터 통합 검색 및 분석"
    purpose_code: str = "WEB"
    daily_use_expect: int = 1000
    requested_by: str | None = None  # 사용자 식별 (jbDataHub username)


# ────────────────────────────────────────────────────────────
# Session management
# ────────────────────────────────────────────────────────────
@router.post("/session")
async def save_session(session: SessionUpdate):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO data_portal_session (label, cookie_jar, user_name, expires_at, valid)
               VALUES ($1, $2, $3, now() + interval '30 days', true)
               ON CONFLICT (label) DO UPDATE
                 SET cookie_jar = EXCLUDED.cookie_jar,
                     user_name  = EXCLUDED.user_name,
                     expires_at = EXCLUDED.expires_at,
                     valid      = true,
                     created_at = now()""",
            session.label, session.cookie_jar, session.user_name,
        )
    return {"saved": True, "label": session.label}


@router.get("/session/status")
async def session_status():
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT label, user_name, created_at, expires_at, last_used, valid FROM data_portal_session WHERE valid=true ORDER BY created_at DESC LIMIT 1"
        )
    if not row:
        return {"has_session": False}
    return {"has_session": True, **dict(row)}


def _parse_cookie_jar(cookie_str: str) -> dict[str, str]:
    """name=value; name=value 형식 → dict (도메인 무관, httpx가 모든 도메인에 자동 적용)"""
    result = {}
    for part in cookie_str.split(';'):
        part = part.strip()
        if '=' in part:
            k, _, v = part.partition('=')
            result[k.strip()] = v.strip()
    return result


async def _get_session_cookie() -> str:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT cookie_jar FROM data_portal_session WHERE valid = true ORDER BY created_at DESC LIMIT 1"
        )
    if not row:
        raise HTTPException(status_code=422, detail="저장된 세션이 없습니다.")
    return row["cookie_jar"]


# ────────────────────────────────────────────────────────────
# 신청 큐
# ────────────────────────────────────────────────────────────
@router.post("/request", status_code=201)
async def request_subscription(req: SubscriptionRequest, bg: BackgroundTasks):
    # 중복 체크 — 같은 user + list_id가 활성 상태면 차단
    pool = get_pool()
    if req.requested_by:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                """SELECT id, status, requested_at, api_key FROM api_subscriptions
                   WHERE requested_by=$1 AND list_id=$2
                     AND status IN ('PENDING','SUBMITTED','APPROVED')
                   ORDER BY requested_at DESC LIMIT 1""",
                req.requested_by, req.list_id,
            )
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "already_requested",
                        "message": f"이미 신청한 데이터셋입니다. (status={existing['status']})",
                        "existing_id": str(existing['id']),
                        "status": existing['status'],
                        "api_key": existing.get('api_key'),
                    },
                )
        # 비활성 상태(ERROR/REJECTED) 기존 row 있으면 UPDATE (재시도) — 새 INSERT 안 함
        if req.requested_by:
            inactive = await conn.fetchrow(
                """SELECT id FROM api_subscriptions
                   WHERE requested_by=$1 AND list_id=$2
                     AND status NOT IN ('PENDING','SUBMITTED','APPROVED')
                   ORDER BY requested_at DESC LIMIT 1""",
                req.requested_by, req.list_id,
            )
            if inactive:
                await conn.execute(
                    """UPDATE api_subscriptions SET
                          status='PENDING', error_message=NULL,
                          retry_count=retry_count+1,
                          requested_at=now(),
                          usage_purpose=$2,
                          raw_request=$3::jsonb
                       WHERE id=$1::uuid""",
                    inactive['id'], req.usage_purpose,
                    json.dumps({"purpose_code": req.purpose_code, "daily_use_expect": req.daily_use_expect, "detail_pk": req.detail_pk}),
                )
                sub_id_reused = str(inactive['id'])
                bg.add_task(_submit_subscription, sub_id_reused)
                return {"id": sub_id_reused, "status": "PENDING", "reused": True}
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO api_subscriptions (list_id, usage_purpose, status, raw_request, requested_by)
               VALUES ($1, $2, 'PENDING', $3::jsonb, $4) RETURNING id""",
            req.list_id, req.usage_purpose,
            json.dumps({"purpose_code": req.purpose_code, "daily_use_expect": req.daily_use_expect, "detail_pk": req.detail_pk}),
            req.requested_by,
        )
        sub_id = str(row["id"])
    bg.add_task(_submit_subscription, sub_id)
    return {"id": sub_id, "status": "PENDING"}


@router.get("/list")
async def list_subscriptions(page: int = 1, limit: int = 50, status: Optional[str] = None, requested_by: Optional[str] = None):
    offset = (page - 1) * limit
    pool = get_pool()
    async with pool.acquire() as conn:
        if status:
            rows = await conn.fetch(
                """SELECT s.id, s.list_id, l.list_title, l.org_nm, s.status,
                          s.requested_at, s.submitted_at, s.approved_at, s.api_key, s.error_message
                   FROM api_subscriptions s LEFT JOIN public_api_list l ON s.list_id = l.list_id
                   WHERE s.status = $1
                   ORDER BY s.requested_at DESC LIMIT $2 OFFSET $3""",
                status, limit, offset,
            )
        else:
            rows = await conn.fetch(
                """SELECT s.id, s.list_id, l.list_title, l.org_nm, s.status,
                          s.requested_at, s.submitted_at, s.approved_at, s.api_key, s.error_message
                   FROM api_subscriptions s LEFT JOIN public_api_list l ON s.list_id = l.list_id
                   ORDER BY s.requested_at DESC LIMIT $1 OFFSET $2""",
                limit, offset,
            )
    return {"items": [dict(r) | {"id": str(r["id"])} for r in rows], "page": page, "limit": limit}


@router.get("/status/{sub_id}")
async def get_subscription(sub_id: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM api_subscriptions WHERE id = $1::uuid", sub_id)
    if not row:
        raise HTTPException(status_code=404)
    d = dict(row); d["id"] = str(d["id"])
    return d


@router.post("/retry/{sub_id}")
async def retry_submission(sub_id: str, bg: BackgroundTasks):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE api_subscriptions SET status='PENDING', error_message=NULL WHERE id=$1::uuid",
            sub_id
        )
    bg.add_task(_submit_subscription, sub_id)
    return {"retried": True, "id": sub_id}


# ────────────────────────────────────────────────────────────
# 자동 제출 worker
# ────────────────────────────────────────────────────────────
async def _submit_subscription(sub_id: str):
    """Playwright 우선 시도, 실패 시 httpx fallback."""
    import os
    if os.environ.get("DATA_PORTAL_USE_PLAYWRIGHT", "true").lower() == "true":
        return await _submit_via_playwright(sub_id)
    return await _submit_via_httpx(sub_id)


async def _submit_via_httpx(sub_id: str):
    pool = get_pool()
    try:
        cookie = await _get_session_cookie()
    except HTTPException as e:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE api_subscriptions SET status='ERROR', error_message=$2 WHERE id=$1::uuid",
                sub_id, e.detail
            )
        return

    async with pool.acquire() as conn:
        sub = await conn.fetchrow("SELECT * FROM api_subscriptions WHERE id=$1::uuid", sub_id)
        if not sub: return
        raw_req = json.loads(sub["raw_request"]) if isinstance(sub["raw_request"], str) else (sub["raw_request"] or {})
        purpose_code = PURPOSE_CODES.get(raw_req.get("purpose_code", "WEB"), "PROS01")
        daily_use = raw_req.get("daily_use_expect", 1000)

    cookies_dict = _parse_cookie_jar(cookie)
    base_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
    }
    # XSRF 이중 검증 (Spring Security): cookie + header 둘 다 같아야 통과
    if cookies_dict.get("XSRF-TOKEN"):
        base_headers["X-XSRF-TOKEN"] = cookies_dict["XSRF-TOKEN"]

    import asyncio

    async def _retry_get(client, url, **kw):
        last_exc = None
        for attempt in range(1, 4):
            try:
                return await client.get(url, **kw)
            except Exception as e:
                last_exc = e
                logger.warning(f"[{sub_id}] attempt {attempt} {type(e).__name__}: {url}")
                await asyncio.sleep(1)
        raise last_exc

    try:
        async with httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            cookies=cookies_dict,
            headers=base_headers,
        ) as client:
            # ── warmup: 메인 페이지 GET (connection 안정화) ──
            await _retry_get(client, f"{DATA_PORTAL_BASE}/")
            # ── (a) redirectDevAcountRequestForm.do — list_id로 신청 폼 직행 ──
            # data.go.kr이 자동으로 적절한 detail_pk로 redirect함
            override_detail_pk = raw_req.get("detail_pk")
            if override_detail_pk:
                form_url = f"{DATA_PORTAL_BASE}/iim/api/selectDevAcountRequestForm.do?publicDataDetailPk={override_detail_pk}"
            else:
                form_url = f"{DATA_PORTAL_BASE}/tcs/dss/redirectDevAcountRequestForm.do?publicDataPk={sub['list_id']}&isBusinessApply=false"

            fr = await _retry_get(
                client, form_url,
                headers={"Referer": f"{DATA_PORTAL_BASE}/data/{sub['list_id']}/openapi.do"}
            )
            final_url = str(fr.url)
            logger.info(f"[{sub_id}] redirect from {form_url} -> {final_url}")
            if "/index.do" in final_url or "/login" in final_url or "loginView" in final_url:
                raise RuntimeError(f"세션이 인증 실패로 메인/로그인 페이지로 redirect됨. cookie 만료 또는 추가 cookie 필요. final_url: {final_url}")

            # final URL 또는 body에서 detail_pk
            m = re.search(r'publicDataDetailPk=(uddi:[a-f0-9-]+_\d+)', final_url)
            if m:
                detail_pk = m.group(1)
            else:
                m = re.search(r'uddi:[a-f0-9-]+_\d+', fr.text)
                detail_pk = m.group() if m else None
            if not detail_pk:
                raise RuntimeError(f"detail_pk not extractable. final_url: {final_url}")

            # ── (b) oprtinSeqNo 추출 ──
            oprtin_seqs = list(dict.fromkeys(re.findall(r'oprtinSeqNo[^>]*value="(\d+)"', fr.text)))
            if not oprtin_seqs:
                # 폼 페이지가 안 보이면 form_url로 한 번 더 시도
                fr2 = await client.get(
                    f"{DATA_PORTAL_BASE}/iim/api/selectDevAcountRequestForm.do?publicDataDetailPk={detail_pk}"
                )
                oprtin_seqs = list(dict.fromkeys(re.findall(r'oprtinSeqNo[^>]*value="(\d+)"', fr2.text)))
                if not oprtin_seqs:
                    raise RuntimeError(f"oprtinSeqNo not found. detail_pk={detail_pk}, body_size={len(fr.text)}, final_url={final_url}")

            # ── (c) 실제 신청 POST ──
            data = {
                "publicDataPk": "",
                "publicDataDetailPk": detail_pk,
                "testStepAtmcConfmAt": "Y",
                "atachFileYn": "N",
                "atchFileId": "",
                "prcuseReqstSeqNo": "",
                "sysTy": "20",
                "businessApply": "false",
                "bfePrcuseReqstSeqNo": "",
                "gbn": "",
                "prcusePrpos": purpose_code,
                "prcusePurps": sub["usage_purpose"],
                "sysIp": "",
                "sysDc": "",
                "useScopeAgreAt": "Y",
            }
            for i, seq in enumerate(oprtin_seqs):
                data[f"oprtinAuthorList[{i}].oprtinSeqNo"] = seq
                data[f"oprtinAuthorList[{i}].dilyUseExpectCo"] = str(daily_use)

            submit_headers = {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": DATA_PORTAL_BASE,
                "Referer": form_url,
                "Accept": "application/json, text/javascript, */*; q=0.01",
            }
            if cookies_dict.get("XSRF-TOKEN"):
                submit_headers["X-XSRF-TOKEN"] = cookies_dict["XSRF-TOKEN"]
            pr = await client.post(
                f"{DATA_PORTAL_BASE}/iim/api/saveDevAcountRequest.do",
                data=data, headers=submit_headers,
            )

            # 응답 파싱
            try:
                resp_json = pr.json()
            except Exception:
                resp_json = {"raw_text": pr.text[:500]}

            ok = 200 <= pr.status_code < 300
            status = "SUBMITTED" if ok else "ERROR"
            error_msg = None if ok else f"HTTP {pr.status_code}: {pr.text[:200]}"

        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE api_subscriptions
                   SET status=$2, submitted_at=now(),
                       portal_apply_id=$3,
                       raw_response=$4::jsonb,
                       error_message=$5,
                       retry_count = retry_count + 1
                   WHERE id=$1::uuid""",
                sub_id, status,
                str(resp_json.get("prcuseReqstSeqNo") or resp_json.get("reqstSeqNo") or ""),
                json.dumps(resp_json), error_msg,
            )
            await conn.execute("UPDATE data_portal_session SET last_used=now() WHERE valid=true")
        logger.info(f"신청 {sub_id} → {status} ({len(oprtin_seqs)} operations)")
    except Exception as e:
        logger.exception(f"신청 {sub_id} 실패")
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE api_subscriptions SET status='ERROR', error_message=$2, retry_count=retry_count+1 WHERE id=$1::uuid",
                sub_id, str(e)[:500]
            )


@router.post("/refresh-status")
async def refresh_all_status(bg: BackgroundTasks):
    """Phase 4: SUBMITTED → APPROVED 매핑 (마이페이지 polling)."""
    return {"todo": "Phase 4 — 마이페이지 polling 구현 예정"}


# ────────────────────────────────────────────────────────────
# Playwright 기반 신청 (SSO 우회)
# ────────────────────────────────────────────────────────────
async def _submit_via_playwright(sub_id: str):
    """Chromium headless로 실제 브라우저 흐름 모방."""
    from playwright.async_api import async_playwright
    
    pool = get_pool()
    try:
        cookie = await _get_session_cookie()
    except HTTPException as e:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE api_subscriptions SET status='ERROR', error_message=$2 WHERE id=$1::uuid",
                sub_id, e.detail
            )
        return

    cookies_dict = _parse_cookie_jar(cookie)

    async with pool.acquire() as conn:
        sub = await conn.fetchrow("SELECT * FROM api_subscriptions WHERE id=$1::uuid", sub_id)
        if not sub: return
        raw_req = json.loads(sub["raw_request"]) if isinstance(sub["raw_request"], str) else (sub["raw_request"] or {})

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                locale="ko-KR",
            )
            # 페이지 로드 가속 — 이미지/폰트/미디어/광고 차단
            async def _block_heavy(route):
                rt = route.request.resource_type
                url = route.request.url
                if rt in ("image", "font", "media", "stylesheet"):
                    await route.abort()
                elif any(x in url for x in ["google-analytics", "googletagmanager", "doubleclick", "facebook.com", "naver.com/analytics"]):
                    await route.abort()
                else:
                    await route.continue_()
            await context.route("**/*", _block_heavy)
            # cookie 주입 (두 도메인)
            pw_cookies = []
            for name, val in cookies_dict.items():
                for domain in ["www.data.go.kr", ".data.go.kr"]:
                    pw_cookies.append({
                        "name": name, "value": val, "domain": domain, "path": "/",
                    })
            await context.add_cookies(pw_cookies)

            page = await context.new_page()
            try:
                # 1) 상세 페이지
                await page.goto(
                    f"{DATA_PORTAL_BASE}/data/{sub['list_id']}/openapi.do",
                    wait_until="domcontentloaded", timeout=30000
                )

                # 2) 활용신청 버튼 클릭 → 새 탭 또는 same-page navigation
                form_page = page  # default
                try:
                    async with context.expect_page(timeout=8000) as new_page_info:
                        await page.click('button:has-text("활용신청"), a:has-text("활용신청")', timeout=10000)
                    form_page = await new_page_info.value
                except Exception:
                    # 새 탭 안 열림 → same-page navigation 가정
                    try:
                        async with page.expect_navigation(timeout=15000):
                            await page.click('button:has-text("활용신청"), a:has-text("활용신청")', timeout=10000)
                    except Exception:
                        # 이미 click은 시도됨 — 그냥 현재 페이지 사용
                        pass
                    form_page = page
                await form_page.wait_for_load_state("domcontentloaded", timeout=30000)

                # 3) URL 또는 페이지 HTML에서 detail_pk 추출
                form_url = form_page.url
                m = re.search(r'publicDataDetailPk=(uddi:[a-f0-9-]+_\d+)', form_url)
                if not m:
                    html = await form_page.content()
                    # hidden input, form action, json data 등에서 detail_pk 탐색
                    for pat in [
                        r'name=["\']publicDataDetailPk["\'][^>]*value=["\'](uddi:[a-f0-9-]+_\d+)',
                        r'value=["\'](uddi:[a-f0-9-]+_\d+)["\'][^>]*name=["\']publicDataDetailPk',
                        r'publicDataDetailPk["\'\s:=]+["\'](uddi:[a-f0-9-]+_\d+)',
                        r'(uddi:[a-f0-9-]+_\d+)',
                    ]:
                        m = re.search(pat, html)
                        if m: break
                if not m:
                    # 마지막 fallback — 데이터셋 상세 페이지 직접 진입해서 추출
                    import asyncio as _asyncio
                    detail_url = f"https://www.data.go.kr/data/{sub['list_id']}/openapi.do"
                    for attempt in range(3):
                        try:
                            await form_page.goto(detail_url, wait_until="domcontentloaded", timeout=25000)
                            html = await form_page.content()
                            m = re.search(r'(uddi:[a-f0-9-]+_\d+)', html)
                            if m: break
                        except Exception as e:
                            logger.warning(f"detail page goto 시도 {attempt+1}/3 실패: {e}")
                            if attempt < 2:
                                await _asyncio.sleep(2 * (attempt + 1))
                if not m:
                    raise RuntimeError(f"detail_pk not found anywhere — URL: {form_url}")

                # 4) 사용목적 입력 — selector 후보 시도
                purpose_filled = False
                for sel in [
                    'textarea[name="prcusePurps"]',
                    'textarea[name="useNm"]',
                    'textarea[name="purpose"]',
                    'textarea[id*="prcuse"]',
                    'textarea[id*="purpose"]',
                    'textarea',  # 최종 fallback
                ]:
                    el = await form_page.query_selector(sel)
                    if el:
                        try:
                            await el.fill(sub["usage_purpose"])
                            purpose_filled = True
                            break
                        except Exception:
                            continue
                if not purpose_filled:
                    # 페이지 디버그 정보 포함해서 에러
                    html_snip = (await form_page.content())[:500]
                    raise RuntimeError(f"purpose textarea not found. URL: {form_page.url}, HTML snippet: {html_snip}")

                # 5) 활용목적 라디오 (PROS01=웹)
                purpose_code = PURPOSE_CODES.get(raw_req.get("purpose_code", "WEB"), "PROS01")
                await form_page.check(f'input[name="prcusePrpos"][value="{purpose_code}"]')

                # 6) 동의 체크박스
                await form_page.check('input[name="useScopeAgreAt"]')

                # 7) 일일 예상 사용량
                daily = raw_req.get("daily_use_expect", 1000)
                inputs = await form_page.query_selector_all('input[name*="dilyUseExpectCo"]')
                for inp in inputs:
                    await inp.fill(str(daily))

                # 8) 신청 버튼 클릭
                async with form_page.expect_response(
                    lambda r: "saveDevAcountRequest" in r.url and r.status < 400,
                    timeout=30000
                ) as resp_info:
                    await form_page.click('button:has-text("신청"), button:has-text("동의")')
                response = await resp_info.value
                resp_body = await response.text()

                try:
                    resp_json = json.loads(resp_body)
                except Exception:
                    resp_json = {"raw": resp_body[:500]}

                async with pool.acquire() as conn:
                    await conn.execute(
                        """UPDATE api_subscriptions
                           SET status='SUBMITTED', submitted_at=now(),
                               portal_apply_id=$2,
                               raw_response=$3::jsonb,
                               retry_count = retry_count + 1
                           WHERE id=$1::uuid""",
                        sub_id,
                        str(resp_json.get("prcuseReqstSeqNo") or ""),
                        json.dumps(resp_json),
                    )
                logger.info(f"[{sub_id}] Playwright 신청 성공")
            finally:
                await browser.close()
    except Exception as e:
        logger.exception(f"[{sub_id}] Playwright 실패")
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE api_subscriptions SET status='ERROR', error_message=$2, retry_count=retry_count+1 WHERE id=$1::uuid",
                sub_id, f"playwright: {str(e)[:400]}"
            )


@router.get("/user-subscribed-ids")
async def user_subscribed_ids(requested_by: str):
    """사용자의 활성 신청 list_id set 반환 (UI 중복 체크용)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT DISTINCT list_id, status FROM api_subscriptions
               WHERE requested_by=$1
                 AND status IN ('PENDING','SUBMITTED','APPROVED')""",
            requested_by,
        )
    return {"items": [dict(r) for r in rows]}


@router.get("/grouped")
async def list_grouped(limit: int = 100, status: Optional[str] = None, requested_by: Optional[str] = None):
    """list_id 기준 그룹 + 시도 이력 (최신 status가 status 필터에 맞는 그룹만)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        # 그룹별 latest 시도 + 전체 시도 카운트
        sql = """
        WITH latest AS (
          SELECT DISTINCT ON (s.list_id)
                 s.list_id, s.id, s.status, s.requested_at, s.submitted_at, s.approved_at,
                 s.error_message, s.api_key, s.retry_count, s.requested_by,
                 l.list_title, l.org_nm, l.new_category_nm
          FROM api_subscriptions s
          LEFT JOIN public_api_list l ON l.list_id = s.list_id
          {WHERE_USER}
          ORDER BY s.list_id, s.requested_at DESC
        ),
        counts AS (
          SELECT list_id, COUNT(*) AS total_attempts,
                 SUM(CASE WHEN status='ERROR' THEN 1 ELSE 0 END) AS error_count
          FROM api_subscriptions
          {WHERE_USER_COUNTS}
          GROUP BY list_id
        )
        SELECT latest.*, counts.total_attempts, counts.error_count
        FROM latest LEFT JOIN counts USING (list_id)
        {WHERE_STATUS}
        ORDER BY latest.requested_at DESC LIMIT $LIMIT_PLACEHOLDER
        """
        where_user = ""
        where_user_counts = ""
        params = []
        if requested_by:
            params.append(requested_by)
            where_user = f"WHERE s.requested_by = ${len(params)}"
            where_user_counts = f"WHERE requested_by = ${len(params)}"
        sql = sql.replace("{WHERE_USER}", where_user).replace("{WHERE_USER_COUNTS}", where_user_counts)

        where_status = ""
        if status:
            params.append(status)
            where_status = f"WHERE latest.status = ${len(params)}"
        sql = sql.replace("{WHERE_STATUS}", where_status)

        params.append(limit)
        sql = sql.replace("$LIMIT_PLACEHOLDER", f"${len(params)}")

        rows = await conn.fetch(sql, *params)

    items = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        for k in ("requested_at","submitted_at","approved_at"):
            if d.get(k): d[k] = d[k].isoformat()
        items.append(d)
    return {"items": items}


@router.get("/{list_id}/attempts")
async def list_attempts(list_id: str, requested_by: Optional[str] = None):
    """특정 list_id의 모든 시도 이력 (최신순)."""
    pool = get_pool()
    where = "WHERE list_id=$1"
    params = [list_id]
    if requested_by:
        params.append(requested_by)
        where += f" AND requested_by=${len(params)}"
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""SELECT id, status, requested_at, submitted_at, error_message, retry_count
                FROM api_subscriptions {where}
                ORDER BY requested_at DESC""",
            *params,
        )
    out = []
    for r in rows:
        d = dict(r); d["id"] = str(d["id"])
        for k in ("requested_at","submitted_at"):
            if d.get(k): d[k] = d[k].isoformat()
        out.append(d)
    return {"items": out}
