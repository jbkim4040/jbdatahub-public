#!/bin/bash
set -euo pipefail

BLUE_PORT=18080
GREEN_PORT=18081
NGINX_CONF=~/nginx-ssl/nginx.conf
STATE_FILE=~/bg-admin-state.txt
IMAGE="admin-portal:latest"
SRC_DIR=~/admin-portal-src/admin-portal
ENV_FILE=~/admin-portal-src/.env

# Determine active/inactive slots
ACTIVE=$(cat "$STATE_FILE" 2>/dev/null || echo "blue")
if [ "$ACTIVE" = "blue" ]; then
    INACTIVE="green"
    INACTIVE_PORT=$GREEN_PORT
    ACTIVE_PORT=$BLUE_PORT
else
    INACTIVE="blue"
    INACTIVE_PORT=$BLUE_PORT
    ACTIVE_PORT=$GREEN_PORT
fi

echo "=== Admin Portal Blue/Green Deploy ==="
echo "Current: $ACTIVE (:$ACTIVE_PORT) → Target: $INACTIVE (:$INACTIVE_PORT)"

# Step 1: Build
echo "[1/5] Building image..."
cd "$SRC_DIR"
git pull origin master
docker build -f backend/Dockerfile -t "$IMAGE" .

# Step 2: Clean up stale inactive container
echo "[2/5] Removing old inactive container (admin-portal-$INACTIVE)..."
docker stop "admin-portal-$INACTIVE" 2>/dev/null || true
docker rm   "admin-portal-$INACTIVE" 2>/dev/null || true

# Step 3: Start new container on inactive port
echo "[3/5] Starting admin-portal-$INACTIVE on port $INACTIVE_PORT..."
docker run -d \
  --name "admin-portal-$INACTIVE" \
  -p "172.17.0.1:$INACTIVE_PORT:8080" \
  --env-file "$ENV_FILE" \
  --restart unless-stopped \
  "$IMAGE"

# Step 4: Health check (max 60s)
echo "[4/5] Health checking http://127.0.0.1:$INACTIVE_PORT/api/health ..."
for i in $(seq 1 20); do
    if curl -sf "http://127.0.0.1:$INACTIVE_PORT/api/health" > /dev/null 2>&1; then
        echo "  Health check passed (attempt $i)"
        break
    fi
    echo "  Attempt $i/20 — waiting 3s..."
    sleep 3
    if [ "$i" -eq 20 ]; then
        echo "Health check FAILED. Rolling back."
        docker stop "admin-portal-$INACTIVE" 2>/dev/null || true
        docker rm   "admin-portal-$INACTIVE" 2>/dev/null || true
        exit 1
    fi
done

# Step 5: Swap nginx upstream
echo "[5/5] Swapping nginx: $ACTIVE_PORT → $INACTIVE_PORT"
sed -i "s|proxy_pass http://127.0.0.1:${ACTIVE_PORT};|proxy_pass http://127.0.0.1:${INACTIVE_PORT};|g" "$NGINX_CONF"
docker exec nginx-ssl nginx -s reload

# Finalize
echo "$INACTIVE" > "$STATE_FILE"
docker stop "admin-portal-$ACTIVE" 2>/dev/null || true
docker rm   "admin-portal-$ACTIVE" 2>/dev/null || true

echo ""
echo "=== Done! Active slot: $INACTIVE (:$INACTIVE_PORT) ==="
