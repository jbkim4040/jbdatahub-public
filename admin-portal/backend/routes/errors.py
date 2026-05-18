from fastapi import APIRouter, HTTPException
from typing import Optional
from database import get_pool

router = APIRouter()

@router.get("")
async def list_errors(page: int = 1, limit: int = 50,
                      status: Optional[str] = None, level: Optional[str] = None):
    offset = (page - 1) * limit
    where, params = [], []
    if status:
        params.append(status); where.append(f"status = ${len(params)}")
    if level:
        params.append(level); where.append(f"level = ${len(params)}")
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    params += [limit, offset]
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""SELECT id, signature_hash, server, container, level,
                       LEFT(sample_line, 500) AS sample_line,
                       occurrence_count, first_seen, last_seen, status, notes
                FROM error_alerts {clause}
                ORDER BY last_seen DESC LIMIT ${len(params)-1} OFFSET ${len(params)}""",
            *params,
        )
        total = await conn.fetchval(f"SELECT COUNT(*) FROM error_alerts {clause}",
                                    *[p for p in params[:-2]])
    return {"items": [dict(r) for r in rows], "total": total, "page": page, "limit": limit}

@router.post("/{error_id}/resolve")
async def resolve(error_id: int):
    pool = get_pool()
    async with pool.acquire() as conn:
        r = await conn.execute("UPDATE error_alerts SET status='resolved' WHERE id=$1", error_id)
    return {"updated": True}

@router.post("/{error_id}/mute")
async def mute(error_id: int):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE error_alerts SET status='muted' WHERE id=$1", error_id)
    return {"updated": True}

@router.get("/stats")
async def stats():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT level, status, COUNT(*) AS cnt
            FROM error_alerts GROUP BY level, status
        """)
    return {"buckets": [dict(r) for r in rows]}
