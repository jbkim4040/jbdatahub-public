from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
import json
from database import get_pool
from models import SecurityReport

router = APIRouter()


@router.get("/reports")
async def list_reports(page: int = 1, limit: int = 10):
    offset = (page - 1) * limit
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM security_reports ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            limit, offset,
        )
    return {"items": [dict(r) for r in rows], "page": page, "limit": limit}


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM security_reports WHERE id = $1", report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return dict(row)


@router.post("/reports", status_code=201)
async def save_report(report: SecurityReport):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO security_reports (build_number, overall_status, tools, duration_min, triggered_by)
               VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *""",
            report.build_number, report.overall_status,
            json.dumps(report.tools), report.duration_min, report.triggered_by,
        )
    return dict(row)


@router.get("/summary")
async def summary():
    since = datetime.now(timezone.utc) - timedelta(days=7)
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM security_reports WHERE created_at >= $1 ORDER BY created_at DESC",
            since,
        )
    rows = [dict(r) for r in rows]
    total = len(rows)
    pass_count = sum(1 for r in rows if r["overall_status"] == "PASS")
    fail_count = sum(1 for r in rows if r["overall_status"] == "FAIL")
    return {
        "total": total,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "pass_rate": round(pass_count / total * 100) if total else 0,
        "last_report": rows[0] if rows else None,
    }
