#!/bin/bash
set -e

# ── 여기만 수정 ──────────────────────────────────────────
DOMAIN="yourdomain.com"          # 실제 도메인
EMAIL="your@email.com"           # 인증서 알림 메일
STAGING=0                        # 테스트 시 1 / 실서비스 시 0
# ────────────────────────────────────────────────────────

echo "=== 1. 디렉토리 준비 ==="
mkdir -p ./nginx/certbot/conf
mkdir -p ./nginx/certbot/www

echo "=== 2. HTTP 전용 설정으로 Nginx 시작 ==="
# 인증서 없어도 nginx가 뜰 수 있도록 HTTP only 설정 사용
cp ./nginx/conf.d/default.http.conf.bak ./nginx/conf.d/default.conf 2>/dev/null || true
docker compose up -d nginx frontend backend

echo "=== 3. 임시 더미 인증서 생성 (nginx ssl 블록 파싱 오류 방지) ==="
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  $([ $STAGING -eq 1 ] && echo "--staging") \
  -d $DOMAIN

echo "=== 4. Certbot 권장 옵션 파일 다운로드 ==="
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
  > ./nginx/certbot/conf/options-ssl-nginx.conf

openssl dhparam -out ./nginx/certbot/conf/ssl-dhparams.pem 2048

echo "=== 5. HTTPS 설정으로 교체 후 Nginx 재시작 ==="
# default.conf 가 이미 HTTPS 설정이면 이 단계는 생략
docker compose restart nginx

echo "=== 6. 전체 서비스 시작 ==="
docker compose up -d

echo ""
echo "✅ 완료! https://$DOMAIN 으로 접속해보세요."