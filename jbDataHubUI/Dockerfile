FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

COPY . .
RUN npm run build

FROM nginx:alpine

RUN apk upgrade --no-cache nghttp2-libs

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx 내장 user(uid 101) 사용 — 3000은 unprivileged port
RUN sed -i 's|listen.*80;|listen 3000;|' /etc/nginx/conf.d/default.conf 2>/dev/null || true
USER nginx
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
