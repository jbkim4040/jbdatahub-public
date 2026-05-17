from fastapi import APIRouter

router = APIRouter()

# ── Agent C: feature/portal-deploy-manager ───────────────────────
# GET  /api/deploy/builds            - Jenkins 빌드 이력
# GET  /api/deploy/builds/{n}        - 특정 빌드 상세 + 로그
# POST /api/deploy/trigger           - 일반 배포 트리거
# POST /api/deploy/security-scan     - 보안 스캔 트리거
# GET  /api/deploy/status            - 현재 Blue/Green 상태
