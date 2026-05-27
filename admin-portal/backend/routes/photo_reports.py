"""
사진 신고 모더레이션 라우트.
recipe-saver의 photo_reports 테이블을 직접 조회해 관리자가 처리할 수 있게 한다.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import get_pool
from middleware.admin_auth import require_roles

router = APIRouter()


@router.get("")
async def list_reports(
    status: str = "pending",
    limit: int = 50,
    _: str = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
):
    """신고된 사진 목록. status: pending | hidden | dismissed"""
    limit = max(1, min(200, limit))
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
              r.id, r.photo_id, r.reporter_ip, r.reason, r.status, r.created_at,
              p.recipe_id, p.device_id, p.caption, p.mime_type, p.is_public
            FROM photo_reports r
            JOIN recipe_photos p ON p.id = r.photo_id
            WHERE r.status = $1
            ORDER BY r.created_at DESC
            LIMIT $2
            """,
            status, limit,
        )
    return [dict(r) for r in rows]


@router.post("/{report_id}/hide")
async def hide_photo(
    report_id: int,
    _: str = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
):
    """신고된 사진을 비공개로 전환하고 신고를 처리 완료로 표시."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT photo_id FROM photo_reports WHERE id = $1", report_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
        async with conn.transaction():
            await conn.execute(
                "UPDATE recipe_photos SET is_public = false WHERE id = $1", row["photo_id"]
            )
            await conn.execute(
                "UPDATE photo_reports SET status = 'hidden' WHERE id = $1", report_id
            )
    return {"ok": True, "photo_id": row["photo_id"]}


@router.post("/{report_id}/dismiss")
async def dismiss_report(
    report_id: int,
    _: str = Depends(require_roles("ADMIN", "SUPER_ADMIN")),
):
    """신고를 무시(문제없음)로 처리."""
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE photo_reports SET status = 'dismissed' WHERE id = $1", report_id
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
    return {"ok": True}
