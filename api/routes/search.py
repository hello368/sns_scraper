"""
검색 API 라우트 — 전체 검색 + YouTube 전용 검색 + 진행 상황
"""
from __future__ import annotations
import uuid
import threading
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from api.schemas import SearchRequest, SearchResponse
from workers.search_worker import SearchWorker
from workers.progress import (
    create_progress, get_progress, complete_progress, request_stop,
)

router = APIRouter(prefix="/search", tags=["search"])


# ─── YouTube 요청 스키마 ────────────────────

class YouTubeSearchRequest(BaseModel):
    keyword: str = Field(..., description="Search term")
    sort_by: str = Field("views", description="views / date / relevance / rating")
    date_filter: str = Field("week", description="hour / today / week / month / year")
    length_filter: str = Field("under4", description="under4 / between420 / plus20")
    max_results: int = Field(20, ge=1, le=100, description="Max results")
    region: str = Field("US", description="Region (US, KR, JP, EU)")


# ─── 전체 검색 ──────────────────────

@router.post("", response_model=SearchResponse)
def search(req: SearchRequest):
    """소셜미디어 플랫폼에서 영상 검색 (백그라운드)"""
    task_id = uuid.uuid4().hex[:12]
    keywords = req.keywords
    platforms = req.platforms or ["youtube", "tiktok"]
    max_per_keyword = req.max_per_keyword
    region = req.region

    total_steps = len(keywords) * len(platforms)
    create_progress(task_id, total_steps)

    def _run():
        worker = SearchWorker()
        try:
            result = worker.run(
                keywords=keywords,
                platforms=platforms,
                max_per_keyword=max_per_keyword,
                region=region,
                task_id=task_id,
                max_days=req.max_days,
                min_likes=req.min_likes,
                min_comments=req.min_comments,
                min_views=req.min_views,
            )
            complete_progress(task_id)
        except Exception as e:
            complete_progress(task_id, error=str(e))

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    return SearchResponse(
        task_id=task_id,
        status="running",
        total_found=0,
        after_dedup=0,
        new_videos=0,
        platforms_used=platforms,
    )


# ─── 플랫폼별 검색 엔드포인트 ──────────────

def _run_platform_search(keyword: str, platform: str, task_id: str,
                          max_days: int, limit: int, region: str = "US", **extra):
    """Run a search on a single platform (키워드 확장 없이 원본 키워드만)"""
    create_progress(task_id, 1)
    def _run():
        worker = SearchWorker()
        try:
            result = worker.run(
                keywords=[keyword],
                platforms=[platform],
                max_per_keyword=limit,
                region=region,
                task_id=task_id,
                max_days=max_days,
                dedup_hours=0,  # 0 = 항상 새로 검색 (수동 클릭이므로)
                expand_keywords=False,  # 개별 탭 검색 — 유저 직접 입력 키워드만 사용
            )
            complete_progress(task_id)
        except Exception as e:
            complete_progress(task_id, error=str(e))
    thread = threading.Thread(target=_run, daemon=True)
    thread.start()


@router.post("/youtube")
def search_youtube(req: YouTubeSearchRequest):
    """Search YouTube"""
    # date_filter enum → max_days 변환 (None = 전체 기간)
    date_to_days = {"hour": 1, "today": 1, "week": 7, "month": 30, "year": 365, "all": None}
    max_days = date_to_days.get(req.date_filter, None)
    task_id = uuid.uuid4().hex[:12]
    _run_platform_search(
        keyword=req.keyword,
        platform="youtube",
        task_id=task_id,
        max_days=max_days,
        limit=req.max_results,
        region=req.region,
    )
    return {"task_id": task_id, "status": "running", "platform": "youtube"}

@router.post("/tiktok")
def search_tiktok(req: YouTubeSearchRequest):
    """Search TikTok by keyword (YouTube 스키마 재사용)"""
    task_id = uuid.uuid4().hex[:12]
    _run_platform_search(
        keyword=req.keyword,
        platform="tiktok",
        task_id=task_id,
        max_days=7,
        limit=req.max_results,
        region=req.region,
    )
    return {"task_id": task_id, "status": "running", "platform": "tiktok"}


# ─── 진행 상황 / 중단 ──────────────────────

@router.get("/progress/{task_id}")
def search_progress(task_id: str):
    """검색 진행 상황 조회"""
    p = get_progress(task_id)
    if not p:
        raise HTTPException(404, f"Task {task_id} not found")
    return p


@router.post("/stop/{task_id}")
def stop_search(task_id: str):
    """검색 중단 요청"""
    p = get_progress(task_id)
    if not p:
        raise HTTPException(404, f"Task {task_id} not found")
    if p["status"] != "running":
        raise HTTPException(400, f"Task is not running (status={p['status']})")
    request_stop(task_id)
    return {
        "task_id": task_id,
        "status": "stopping",
        "message": "Stop requested. Collected results will be saved.",
    }
