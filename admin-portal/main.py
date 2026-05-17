from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from routes import pr, security, deploy, request

app = FastAPI(title="JB Admin Portal", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pr.router,       prefix="/api/prs",      tags=["PR"])
app.include_router(security.router, prefix="/api/security", tags=["Security"])
app.include_router(deploy.router,   prefix="/api/deploy",   tags=["Deploy"])
app.include_router(request.router,  prefix="/api/request",  tags=["Request"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


DIST = Path(__file__).parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="static")
else:
    @app.get("/")
    def root():
        return {"message": "Frontend not built yet. Run: cd frontend && npm run build"}
