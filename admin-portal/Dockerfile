FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
EXPOSE 8080
RUN groupadd -r app && useradd -r -g app -u 1000 app && chown -R app:app /app
USER 1000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
