FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

# Playwright Chromium 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxcb1 libxkbcommon0 libx11-6 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 fonts-noto-cjk curl \
 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

# Playwright Chromium 다운로드 (ARM 호환)
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN playwright install chromium

RUN groupadd -r app && useradd -r -g app -u 1000 app && chown -R app:app /app /opt/playwright
USER 1000

COPY --chown=app:app backend/ .
COPY --from=frontend-builder --chown=app:app /app/frontend/dist ./frontend/dist
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
