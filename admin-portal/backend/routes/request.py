"""기능 요구사항 저장 — Claude API 의존성 제거 (단순 CRUD)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime
from database import get_pool

router = APIRouter()


class RequestIn(BaseModel):
    title: str
    description: str
    request_type: Literal["추가", "수정", "삭제", "버그"] = "추가"
    target_area: Optional[str] = None
    priority: Literal["urgent", "high", "normal", "low"] = "normal"
    created_by: Optional[str] = None


class RequestUpdate(BaseModel):
    status: Optional[Literal["pending", "in_progress", "done", "rejected"]] = None
    priority: Optional[Literal["urgent", "high", "normal", "low"]] = None
    claude_pr_url: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_requests(status: Optional[str] = None, limit: int = 50):
    pool = get_pool()
    async with pool.acquire() as conn:
        if status:
            rows = await conn.fetch(
                """SELECT * FROM feature_requests WHERE status=$1
                   ORDER BY
                     CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
                     created_at DESC
                   LIMIT $2""",
                status, limit,
            )
        else:
            rows = await conn.fetch(
                """SELECT * FROM feature_requests
                   ORDER BY
                     CASE status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
                     CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
                     created_at DESC
                   LIMIT $1""",
                limit,
            )
    items = []
    for r in rows:
        d = dict(r)
        for k in ("created_at", "updated_at"):
            if d.get(k):
                d[k] = d[k].isoformat()
        items.append(d)
    return {"items": items, "total": len(items)}


@router.post("", status_code=201)
async def create_request(req: RequestIn):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO feature_requests
                 (title, description, request_type, target_area, priority, created_by)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id, created_at""",
            req.title, req.description, req.request_type,
            req.target_area, req.priority, req.created_by,
        )
    return {"id": row["id"], "created_at": row["created_at"].isoformat(), "status": "pending"}


@router.patch("/{req_id}")
async def update_request(req_id: int, body: RequestUpdate):
    fields = []
    params = []
    if body.status is not None:
        params.append(body.status); fields.append(f"status=${len(params)}")
    if body.priority is not None:
        params.append(body.priority); fields.append(f"priority=${len(params)}")
    if body.claude_pr_url is not None:
        params.append(body.claude_pr_url); fields.append(f"claude_pr_url=${len(params)}")
    if body.notes is not None:
        params.append(body.notes); fields.append(f"notes=${len(params)}")
    if not fields:
        raise HTTPException(400, "변경할 필드가 없습니다")
    fields.append("updated_at=NOW()")
    params.append(req_id)

    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE feature_requests SET {', '.join(fields)} WHERE id=${len(params)}",
            *params,
        )
    return {"updated": True}


@router.delete("/{req_id}", status_code=204)
async def delete_request(req_id: int):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM feature_requests WHERE id=$1", req_id)
    return None


@router.get("/stats")
async def stats():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT status, COUNT(*) AS cnt FROM feature_requests GROUP BY status"
        )
    return {"buckets": [dict(r) for r in rows]}
