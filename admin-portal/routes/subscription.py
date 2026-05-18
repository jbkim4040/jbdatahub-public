"""공공데이터포털 (data.go.kr) API 사용신청 자동화."""
import json
import logging
from datetime import datetime, timezone
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from database import get_pool

logger = logging.getLogger(__name__)
router = APIRouter()

DATA_PORTAL_BASE = "https://www.data.go.kr"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 jb-datahub/1.0"


# ────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────
class SessionUpdate(BaseModel):
    cookie_jar: str             # 브라우저에서 복사한 cookie (예: "JSESSIONID=...; SCOUTER=...")
    user_name: Optional[str] = None
    label: str = "default"


class SubscriptionRequest(BaseModel):
    list_id: str                # public_api_list.list_id
    operation_seq: Optional[int] = None
    usage_purpose: str = "jb-workspace 통합 데이터 허브 운영"


# ────────────────────────────────────────────────────────────
# Session management
# ────────────────────────────────────────────────────────────
@router.post("/session")
async def save_session(session: SessionUpdate):
    """브라우저에서 추출한 data.go.kr 세션 쿠키 저장."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO data_portal_session (label, cookie_jar, user_name, expires_at, valid)
            VALUES ($1, $2, $3, now() + interval '30 days', true)
            ON CONFLICT (label) DO UPDATE
              SET cookie_jar = EXCLUDED.cookie_jar,
                  user_name  = EXCLUDED.user_name,
                  expires_at = EXCLUDED.expires_at,
                  valid      = true,
                  created_at = now()
            """,
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
    d = dict(row)
    return {"has_session": True, **d}


async def _get_session_cookie() -> str:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT cookie_jar FROM data_portal_session WHERE valid = true ORDER BY created_at DESC LIMIT 1"
        )
    if not row:
        raise HTTPException(status_code=422, detail="저장된 세션이 없습니다. /api/subscription/session 으로 cookie 등록 필요")
    return row["cookie_jar"]


# ────────────────────────────────────────────────────────────
# 신청 큐 + 상태 조회
# ────────────────────────────────────────────────────────────
@router.post("/request", status_code=201)
async def request_subscription(req: SubscriptionRequest, bg: BackgroundTasks):
    """신청 큐에 추가. 백그라운드 worker가 처리."""
    pool = get_pool()
    async with pool.acquire() as conn:
        # 중복 신청 방지
        existing = await conn.fetchrow(
            "SELECT id, status FROM api_subscriptions WHERE list_id=$1 AND status IN ('PENDING','SUBMITTED','APPROVED')",
            req.list_id,
        )
        if existing:
            return {"already_exists": True, "id": str(existing["id"]), "status": existing["status"]}

        row = await conn.fetchrow(
            """INSERT INTO api_subscriptions (list_id, operation_seq, usage_purpose, status)
               VALUES ($1, $2, $3, 'PENDING') RETURNING id""",
            req.list_id, req.operation_seq, req.usage_purpose,
        )
        sub_id = str(row["id"])

    # 백그라운드로 자동 제출 시도
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
                   FROM api_subscriptions s
                   LEFT JOIN public_api_list l ON s.list_id = l.list_id
                   WHERE s.status = $1
                   ORDER BY s.requested_at DESC LIMIT $2 OFFSET $3""",
                status, limit, offset,
            )
        else:
            rows = await conn.fetch(
                """SELECT s.id, s.list_id, l.list_title, l.org_nm, s.status,
                          s.requested_at, s.submitted_at, s.approved_at, s.api_key, s.error_message
                   FROM api_subscriptions s
                   LEFT JOIN public_api_list l ON s.list_id = l.list_id
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


@router.post("/refresh-status")
async def refresh_all_status(bg: BackgroundTasks):
    """SUBMITTED 상태 신청들의 승인 여부 재조회 (data.go.kr 폴링)."""
    bg.add_task(_poll_pending_subscriptions)
    return {"queued": True}


# ────────────────────────────────────────────────────────────
# 자동 제출 worker (백그라운드)
# ────────────────────────────────────────────────────────────
async def _submit_subscription(sub_id: str):
    """data.go.kr에 신청서 자동 제출.
    
    실제 흐름은 data.go.kr UI 분석 후 구체화 필요. 현재는 PoC 스켈레톤:
      1. cookie 로드
      2. 신청 페이지 GET → CSRF token 추출
      3. 신청서 POST (사용목적, 활용분야 등)
      4. 응답에서 신청 ID 추출
      5. DB 업데이트
    """
    pool = get_pool()
    try:
        cookie = await _get_session_cookie()
    except HTTPException as e:
        logger.warning(f"세션 없음 — 신청 {sub_id} 보류: {e.detail}")
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE api_subscriptions SET status='ERROR', error_message=$2 WHERE id=$1::uuid",
                sub_id, "no_session"
            )
        return

    async with pool.acquire() as conn:
        sub = await conn.fetchrow("SELECT * FROM api_subscriptions WHERE id=$1::uuid", sub_id)
        if not sub:
            return

    headers = {
        "User-Agent": USER_AGENT,
        "Cookie": cookie,
        "Referer": f"{DATA_PORTAL_BASE}/data/{sub['list_id']}/openapi.do",
    }

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            # ── PoC: 신청 페이지 접근 가능한지 확인 ──
            r = await client.get(
                f"{DATA_PORTAL_BASE}/iim/api/selectAPIAcountView.do",
                params={"publicDataPk": sub["list_id"]},
                headers=headers,
            )
            ok = 200 <= r.status_code < 400
            status = "SUBMITTED" if ok else "ERROR"
            error_msg = None if ok else f"HTTP {r.status_code}"

        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE api_subscriptions
                   SET status=$2, submitted_at=now(), raw_response=$3::jsonb, error_message=$4,
                       retry_count = retry_count + 1
                   WHERE id=$1::uuid""",
                sub_id, status,
                json.dumps({"http_status": r.status_code, "url": str(r.url), "body_len": len(r.text)}),
                error_msg,
            )
            await conn.execute(
                "UPDATE data_portal_session SET last_used=now() WHERE valid=true"
            )
        logger.info(f"신청 {sub_id} → {status}")
    except Exception as e:
        logger.error(f"신청 {sub_id} 실패: {e}")
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE api_subscriptions SET status='ERROR', error_message=$2 WHERE id=$1::uuid",
                sub_id, str(e)[:500]
            )


async def _poll_pending_subscriptions():
    """SUBMITTED 상태 신청들의 승인 여부 확인."""
    # PoC: 추후 구현. 마이페이지 신청 현황 페이지 크롤링
    logger.info("status polling: not yet implemented (Phase 3)")
