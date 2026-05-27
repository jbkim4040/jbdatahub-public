"""
Gemini API 사용량 모니터링 라우트.
recipe-saver가 호출할 때마다 gemini_usage 테이블에 한 줄씩 적는다.
admin-portal 프론트엔드는 이 라우트들을 호출해 대시보드를 그림.
"""
from fastapi import APIRouter, HTTPException
from database import get_pool

router = APIRouter()

# ─── Gemini 2.5 Flash 가격 (paid tier) — 1M token 당 USD ───
FLASH_INPUT_PRICE_USD  = 0.075
FLASH_OUTPUT_PRICE_USD = 0.30

# ─── 무료 티어 한도 (Flash, 일일) ───
FREE_TIER_RPD = 1500
FREE_TIER_TPD = 1_000_000


@router.get("/summary")
async def summary():
    """오늘 + 이번달 합계, 무료티어 잔여량, 평균 latency."""
    pool = get_pool()
    async with pool.acquire() as conn:
        today = await conn.fetchrow("""
            SELECT
              COUNT(*)::int                                       AS calls,
              COUNT(*) FILTER (WHERE status='ok')::int            AS ok_calls,
              COUNT(*) FILTER (WHERE status<>'ok')::int           AS failed_calls,
              COALESCE(SUM(input_tokens),  0)::int                AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::int                AS output_tokens,
              COALESCE(SUM(cost_usd),      0)::float              AS cost_usd,
              CASE WHEN COUNT(*) = 0 THEN 0
                   ELSE ROUND(AVG(latency_ms)::numeric, 0)::int END AS avg_latency_ms
            FROM gemini_usage
            WHERE ts >= date_trunc('day', NOW())
        """)
        month = await conn.fetchrow("""
            SELECT
              COUNT(*)::int                          AS calls,
              COALESCE(SUM(input_tokens),  0)::int   AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::int   AS output_tokens,
              COALESCE(SUM(cost_usd),      0)::float AS cost_usd
            FROM gemini_usage
            WHERE ts >= date_trunc('month', NOW())
        """)
        # 최근 3일 평균(이 페이스 유지 시 월 예상)
        last3 = await conn.fetchrow("""
            SELECT
              COALESCE(SUM(cost_usd), 0)::float AS cost_usd,
              COUNT(*)::int                     AS calls
            FROM gemini_usage
            WHERE ts >= NOW() - INTERVAL '3 days'
        """)

    today_total_tokens = today["input_tokens"] + today["output_tokens"]
    daily_avg_cost     = (last3["cost_usd"] or 0) / 3.0
    projected_month    = daily_avg_cost * 30.0

    return {
        "today": {
            "calls":         today["calls"],
            "ok_calls":      today["ok_calls"],
            "failed_calls":  today["failed_calls"],
            "input_tokens":  today["input_tokens"],
            "output_tokens": today["output_tokens"],
            "total_tokens":  today_total_tokens,
            "cost_usd":      today["cost_usd"],
            "avg_latency_ms": today["avg_latency_ms"],
        },
        "month": {
            "calls":         month["calls"],
            "input_tokens":  month["input_tokens"],
            "output_tokens": month["output_tokens"],
            "total_tokens":  month["input_tokens"] + month["output_tokens"],
            "cost_usd":      month["cost_usd"],
            "projected_cost_usd": projected_month,
        },
        "free_tier": {
            "rpd_limit":      FREE_TIER_RPD,
            "rpd_used":       today["calls"],
            "rpd_remaining":  max(0, FREE_TIER_RPD - today["calls"]),
            "rpd_pct_used":   round(100.0 * today["calls"] / FREE_TIER_RPD, 1) if FREE_TIER_RPD else 0,
            "tpd_limit":      FREE_TIER_TPD,
            "tpd_used":       today_total_tokens,
            "tpd_remaining":  max(0, FREE_TIER_TPD - today_total_tokens),
            "tpd_pct_used":   round(100.0 * today_total_tokens / FREE_TIER_TPD, 1) if FREE_TIER_TPD else 0,
        },
        "pricing": {
            "model":               "gemini-2.5-flash",
            "input_per_mtok_usd":  FLASH_INPUT_PRICE_USD,
            "output_per_mtok_usd": FLASH_OUTPUT_PRICE_USD,
        },
    }


@router.get("/timeseries")
async def timeseries(days: int = 30):
    """일별 호출수·토큰·비용. 없는 날은 0으로 채워서 반환."""
    days = max(1, min(90, days))
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            WITH series AS (
              SELECT generate_series(
                date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
                date_trunc('day', NOW()),
                INTERVAL '1 day'
              )::date AS day
            )
            SELECT
              s.day::text                                 AS day,
              COALESCE(COUNT(g.id),         0)::int       AS calls,
              COALESCE(SUM(g.input_tokens), 0)::int       AS input_tokens,
              COALESCE(SUM(g.output_tokens),0)::int       AS output_tokens,
              COALESCE(SUM(g.cost_usd),     0)::float     AS cost_usd
            FROM series s
            LEFT JOIN gemini_usage g
                   ON date_trunc('day', g.ts) = s.day
            GROUP BY s.day
            ORDER BY s.day
            """,
            days,
        )
    return [dict(r) for r in rows]


@router.get("/recent-failures")
async def recent_failures(limit: int = 20):
    """최근 실패 호출 — rate limit·timeout·parsing error 등 디버깅용."""
    limit = max(1, min(100, limit))
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, ts, model, status, error, latency_ms, url, source
            FROM gemini_usage
            WHERE status <> 'ok'
            ORDER BY ts DESC
            LIMIT $1
            """,
            limit,
        )
    return [dict(r) for r in rows]
