import logging
import sys

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from database import init_pool, close_pool
import asyncio
from routes import pr, security, deploy, request, reports, subscription, errors, portal_login, gemini_usage
from routes.portal_login import session_expiry_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    # data.go.kr 세션 만료 모니터링 (60초 간격)
    bg_task = asyncio.create_task(session_expiry_scheduler())
    try:
        yield
    finally:
        bg_task.cancel()
        try:
            await bg_task
        except asyncio.CancelledError:
            pass
        await close_pool()


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)
logger.info("Admin Portal starting")

app = FastAPI(title="JB Admin Portal", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://jbdatahub.com",
        "https://admin.jbdatahub.com",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

from middleware.admin_auth import admin_auth_middleware
app.middleware("http")(admin_auth_middleware)

app.include_router(pr.router,       prefix="/api/prs",      tags=["PR"])
app.include_router(security.router, prefix="/api/security", tags=["Security"])
app.include_router(deploy.router,   prefix="/api/deploy",   tags=["Deploy"])
app.include_router(request.router,  prefix="/api/request",  tags=["Request"])
app.include_router(reports.router,  prefix="/api/reports",  tags=["Reports"])
app.include_router(subscription.router, prefix="/api/subscription", tags=["Subscription"])
app.include_router(portal_login.router, prefix="/api/portal-login", tags=["PortalLogin"])
app.include_router(errors.router,   prefix="/api/errors",   tags=["Errors"])
app.include_router(gemini_usage.router, prefix="/api/gemini-usage", tags=["GeminiUsage"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


DIST = Path(__file__).parent / "frontend" / "dist"
if DIST.exists():
    from fastapi import Request
    from fastapi.responses import FileResponse, JSONResponse

    @app.exception_handler(404)
    async def spa_fallback(request: Request, exc):
        if request.url.path.startswith("/api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        index = DIST / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"detail": "index.html not found"}, status_code=404)

    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="static")
else:
    @app.get("/")
    def root():
        return {"message": "Frontend not built yet."}
