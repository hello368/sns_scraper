"""
MediSpa AI — FastAPI 서버 진입점
"""
from __future__ import annotations
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.errors import MediSpaError, ERROR_TO_STATUS
from core.models import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("medispa")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작/종료 시 실행"""
    logger.info("🚀 MediSpa AI 서버 시작...")
    init_db()
    # 시드: 첫 실행 시 admin 계정 생성
    from api.routes.auth import seed_admin
    seed_admin()
    logger.info("✅ DB 초기화 완료")
    yield
    logger.info("👋 서버 종료")


app = FastAPI(
    title="MediSpa AI",
    version="0.2.0",
    description="Medical spa treatment video search & download system",
    lifespan=lifespan,
)

# CORS — 개발 환경: 모든 오리진 허용 (배포 시 특정 도메인으로 제한 필요)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── 글로벌 에러 핸들러 ──────────────────────────────────

@app.exception_handler(MediSpaError)
async def medispa_error_handler(request: Request, exc: MediSpaError):
    status = ERROR_TO_STATUS.get(type(exc), 500)
    return JSONResponse(
        status_code=status,
        content={
            "error": str(exc),
            "detail": exc.detail,
            "recoverable": exc.recoverable,
        },
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ─── 라우트 등록 ─────────────────────────────────────────

from api.routes.search import router as search_router
from api.routes.download import router as download_router
from api.routes.library import router as library_router
from api.routes.system import router as system_router
from api.routes.auth import router as auth_router

app.include_router(search_router)
app.include_router(download_router)
app.include_router(library_router)
app.include_router(system_router)
app.include_router(auth_router)


@app.get("/")
def root():
    return {
        "service": "MediSpa AI",
        "version": "0.2.0",
        "docs": "/docs",
    }
