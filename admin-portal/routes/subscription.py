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
            "SELECT label, user_name, created_at, expires_at, last_used, valid FROM data_portal_session ORDER BY created_at DESC LIMIT 1"
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
    pool = get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id, status FROM api_subscriptions WHERE list_id=$1 AND status IN ('PENDING','SUBMITTED','APPROVED')",
            req.list_id,
        )
        if existing:
            return {"already_exists": True, "id": str(existing["id"]), "status": existing["status"]}

        row = await conn.fetchrow(
            """INSERT INTO api_subscriptions (list_id, usage_purpose, status, raw_request)
               VALUES ($1, $2, 'PENDING', $3::jsonb) RETURNING id""",
            req.list_id, req.usage_purpose,
            json.dumps({"purpose_code": req.purpose_code, "daily_use_expect": req.daily_use_expect, "detail_pk": req.detail_pk}),
        )
        sub_id = str(row["id"])
    bg.add_task(_submit_subscription, sub_id)
    return {"id": sub_id, "status": "PENDING"}


@router.get("/list")
async def list_subscriptions(page: int = 1, limit: int = 50, status: Optional[str] = None):
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
    base_headers = {"User-Agent": USER_AGENT}

    try:
        # cookies 매개변수로 전달 → httpx가 모든 도메인에 자동 적용 (SSO redirect 시에도)
        async with httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            cookies=cookies_dict,
            headers=base_headers,
        ) as client:
            # ── (a) redirectDevAcountRequestForm.do — list_id로 신청 폼 직행 ──
            # data.go.kr이 자동으로 적절한 detail_pk로 redirect함
            override_detail_pk = raw_req.get("detail_pk")
            if override_detail_pk:
                form_url = f"{DATA_PORTAL_BASE}/iim/api/selectDevAcountRequestForm.do?publicDataDetailPk={override_detail_pk}"
            else:
                form_url = f"{DATA_PORTAL_BASE}/tcs/dss/redirectDevAcountRequestForm.do?publicDataPk={sub['list_id']}&isBusinessApply=false"

            fr = await client.get(form_url)
            final_url = str(fr.url)
            logger.info(f"[{sub_id}] redirect from {form_url} -> {final_url}")

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
