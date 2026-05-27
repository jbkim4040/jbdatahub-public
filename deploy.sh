#!/bin/bash
# Server 1에서 직접 실행되는 Blue/Green 배포 스크립트
set -eo pipefail

WORKSPACE_DIR="/home/ubuntu/jb-workspace-deploy"
STATE_FILE="/home/ubuntu/bg-state.txt"
NETWORK="jb-workspace_app-network"
ENV_FILE="/home/ubuntu/.secrets/jbdatahub.env"

# ── 1. active 색상 결정 ──────────────────────────────────────────────
ACTIVE=$(cat "$STATE_FILE" 2>/dev/null || echo "blue")
# STATE_FILE 값 화이트리스트 검증 — 파일 조작으로 인한 컨테이너명 인젝션 방지
if [ "$ACTIVE" != "blue" ] && [ "$ACTIVE" != "green" ]; then
    echo "STATE_FILE 값 비정상 ('$ACTIVE') — blue로 강제 초기화"
    ACTIVE="blue"
fi
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
docker build -t jbdatahub-backend:latest $WORKSPACE_DIR/server/jbdatahub
docker stop jbdatahub-${INACTIVE} 2>/dev/null || true
docker rm   jbdatahub-${INACTIVE} 2>/dev/null || true
docker run -d \
    --name jbdatahub-${INACTIVE} \
    --restart unless-stopped \
    --log-opt max-size=20m \
    --log-opt max-file=5 \
    --env-file "$ENV_FILE" \
    -e SPRING_PROFILES_ACTIVE=prod \
    -e TZ=Asia/Seoul \
    -p ${HOST_PORT}:8080 \
    --network $NETWORK \
    jbdatahub-backend:latest

# ── 4. 헬스체크 (5초 간격 × 최대 60회 = 5분) ───────────────────────
echo "헬스체크 시작 (jbdatahub-${INACTIVE})..."
PASSED=0
for i in $(seq 1 60); do
    # 컨테이너가 이미 종료됐으면 즉시 실패 (기동 오류 조기 감지)
    RUNNING=$(docker inspect --format '{{.State.Running}}' "jbdatahub-${INACTIVE}" 2>/dev/null || echo "false")
    if [ "$RUNNING" != "true" ]; then
        echo "❌ 컨테이너 종료 감지 — 마지막 로그:"
        docker logs "jbdatahub-${INACTIVE}" --tail 40 2>&1
        docker rm "jbdatahub-${INACTIVE}" 2>/dev/null || true
        exit 1
    fi
    STATUS=$(docker exec jbdatahub-${INACTIVE} \
        curl -s -o /dev/null -w "%{http_code}" \
        http://localhost:8080/api/health 2>/dev/null) || STATUS="000"
    echo "[${i}/60] health=${STATUS}"
    if [ "$STATUS" = "200" ]; then
        echo "✅ 헬스체크 통과"
        PASSED=1
        break
    fi
    sleep 5
done

if [ "$PASSED" = "0" ]; then
    echo "❌ 헬스체크 타임아웃 (300초) — 마지막 로그:"
    docker logs jbdatahub-${INACTIVE} --tail 40 2>&1
    docker stop jbdatahub-${INACTIVE} 2>/dev/null || true
    exit 1
fi

# ── 5. nginx upstream 전환 ───────────────────────────────────────────
# 임시 파일에 생성 → 토큰 치환 검증 → nginx -t 통과 후에만 교체 (TOCTOU 방지)
NGINX_CONF_TMP=$(mktemp)
sed "s/ACTIVE_COLOR/jbdatahub-${INACTIVE}/" \
    "$WORKSPACE_DIR/nginx/conf.d/was.conf.tmpl" > "$NGINX_CONF_TMP"
if grep -q "ACTIVE_COLOR" "$NGINX_CONF_TMP"; then
    echo "❌ nginx 템플릿 치환 실패 — ACTIVE_COLOR 토큰 미치환"
    rm -f "$NGINX_CONF_TMP"; docker stop "jbdatahub-${INACTIVE}" 2>/dev/null || true; exit 1
fi
cp "$NGINX_CONF_TMP" /home/ubuntu/nginx-ssl/jbdatahub.conf
rm -f "$NGINX_CONF_TMP"
if ! docker exec nginx nginx -t; then
    echo "❌ nginx 설정 검증 실패 — 전환 중단, 구 컨테이너(${ACTIVE}) 유지"
    docker stop "jbdatahub-${INACTIVE}" 2>/dev/null || true
    exit 1
fi
docker exec nginx nginx -s reload
echo "✅ nginx → jbdatahub-${INACTIVE}"

# ── 6. 상태 저장 (전환 성공 직후 — 데스싱크 방지) ───────────────────
# nginx 가 이미 INACTIVE 를 가리키므로, 이후 단계 실패해도 state 파일은 정확해야 함
echo "${INACTIVE}" > $STATE_FILE
echo "✅ 상태 저장 — active: ${INACTIVE}"

# ── 7. 이전 컨테이너 중지 & 제거 ────────────────────────────────────
# -t 30: graceful shutdown 을 위해 SIGTERM 후 30초 대기 (in-flight 요청 처리 완료)
docker stop -t 30 jbdatahub-${ACTIVE} 2>/dev/null || true
docker rm        jbdatahub-${ACTIVE} 2>/dev/null || true
echo "✅ jbdatahub-${ACTIVE} 중지 및 제거"
echo "✅ Blue/Green 배포 완료 — active: ${INACTIVE}"
