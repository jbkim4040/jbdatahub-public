from fastapi import APIRouter

router = APIRouter()

# ── Agent B: feature/portal-security-history ─────────────────────
# GET  /api/security/reports        - 보안 보고서 목록 (페이지네이션)
# GET  /api/security/reports/{id}   - 특정 보고서 상세
# POST /api/security/reports        - 보고서 저장 (Jenkins 완료 시 호출)
# GET  /api/security/summary        - 최근 7일 취약점 트렌드
