#!/bin/bash
# Server 1에서 직접 실행되는 Blue/Green 배포 스크립트
set -e

WORKSPACE_DIR="/home/ubuntu/jb-workspace-deploy"
STATE_FILE="/var/jenkins_home/bg-state.txt"
NETWORK="jb-workspace_app-network"

# ── 1. active 색상 결정 ──────────────────────────────────────────────
ACTIVE=$(cat $STATE_FILE 2>/dev/null || echo "blue")
if [ "$ACTIVE" = "blue" ]; then
    INACTIVE="green"
    HOST_PORT=8081
else
    INACTIVE="blue"
    HOST_PORT=8080
fi
echo "현재 active=${ACTIVE} / 배포 대상=${INACTIVE} / 포트=${HOST_PORT}"

# ── 2. 기존 단일 컨테이너 정리 (첫 전환 시) ─────────────────────────
docker stop jbdatahub 2>/dev/null || true
docker rm   jbdatahub 2>/dev/null || true

# ── 3. Inactive 컨테이너 빌드 & 시작 ────────────────────────────────
docker build -t jbdatahub-backend:latest $WORKSPACE_DIR/jbDataHub
docker stop jbdatahub-${INACTIVE} 2>/dev/null || true
docker rm   jbdatahub-${INACTIVE} 2>/dev/null || true
docker run -d \
    --name jbdatahub-${INACTIVE} \
    --restart unless-stopped \
    --log-opt max-size=20m \
    --log-opt max-file=5 \
    --env-file /tmp/.env \
    -e SPRING_PROFILES_ACTIVE=prod \
    -p ${HOST_PORT}:8080 \
    --network $NETWORK \
    jbdatahub-backend:latest

# ── 4. 헬스체크 (5초 간격 × 최대 240회 = 20분) ──────────────────────
echo "헬스체크 시작 (jbdatahub-${INACTIVE})..."
PASSED=0
for i in $(seq 1 240); do
    STATUS=$(docker exec jbdatahub-${INACTIVE} \
        curl -s -o /dev/null -w "%{http_code}" \
        http://localhost:8080/api/health 2>/dev/null) || STATUS="000"
    echo "[${i}/240] health=${STATUS}"
    if [ "$STATUS" = "200" ]; then
        echo "✅ 헬스체크 통과"
        PASSED=1
        break
    fi
    sleep 5
done

if [ "$PASSED" = "0" ]; then
    echo "❌ 헬스체크 타임아웃 (1200초) — 롤백"
    docker stop jbdatahub-${INACTIVE} 2>/dev/null || true
    exit 1
fi

# ── 5. nginx upstream 전환 ───────────────────────────────────────────
sed "s/ACTIVE_COLOR/jbdatahub-${INACTIVE}/" \
    $WORKSPACE_DIR/nginx/conf.d/default.conf.tmpl > /tmp/nginx-bg.conf
docker cp /tmp/nginx-bg.conf nginx:/etc/nginx/conf.d/default.conf
docker exec nginx nginx -t && docker exec nginx nginx -s reload
echo "✅ nginx → jbdatahub-${INACTIVE}"

# ── 6. 이전 컨테이너 중지 & 제거 ────────────────────────────────────
docker stop jbdatahub-${ACTIVE} 2>/dev/null || true
docker rm   jbdatahub-${ACTIVE} 2>/dev/null || true
echo "✅ jbdatahub-${ACTIVE} 중지 및 제거"

# ── 7. 상태 저장 ─────────────────────────────────────────────────────
echo "${INACTIVE}" > $STATE_FILE
echo "✅ Blue/Green 배포 완료 — active: ${INACTIVE}"
