from fastapi import APIRouter

router = APIRouter()

# ── Agent A: feature/portal-pr-review ────────────────────────────
# GET  /api/prs              - GitHub PR 목록
# GET  /api/prs/{n}          - PR 상세 + 리뷰 이력
# POST /api/prs/{n}/review   - Claude 코드 리뷰 트리거
# POST /api/prs/{n}/merge    - PR squash merge
# POST /api/webhook/github   - GitHub webhook 수신 (PR 이벤트)
