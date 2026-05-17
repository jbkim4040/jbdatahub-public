from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
from database import get_db
from models import SecurityReport

router = APIRouter()


@router.get("/reports")
async def list_reports(page: int = 1, limit: int = 10):
    db = get_db()
    offset = (page - 1) * limit
    result = (
        db.table("security_reports")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"items": result.data, "page": page, "limit": limit}


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    db = get_db()
    result = db.table("security_reports").select("*").eq("id", report_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")
    return result.data[0]


@router.post("/reports", status_code=201)
async def save_report(report: SecurityReport):
    db = get_db()
    result = db.table("security_reports").insert(report.model_dump()).execute()
    return result.data[0]


@router.get("/summary")
async def summary():
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    result = (
        db.table("security_reports")
        .select("*")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data
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
