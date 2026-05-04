"""
검색 API 라우트 — 전체 검색 + 플랫폼별 전용 검색 + 진행 상황
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


# ─── 플랫폼별 요청 스키마 ────────────────────

class InstagramSearchRequest(BaseModel):
    keyword: str = Field(..., description="Search term (hashtag name)")
    search_type: str = Field("hashtag", description="hashtag / profile / place / user")
    content_type: str = Field("posts", description="posts / reels / details / comments")
    hashtags: list[str] = Field(default_factory=list, description="Multi hashtags")
    max_days: int = Field(7, ge=1, le=365, description="Search period (days)")
    results_limit: int = Field(20, ge=1, le=100, description="Max results")
    region: str = Field("US", description="Region (US, KR, JP, EU)")

class TikTokSearchRequest(BaseModel):
    keyword: str = Field(..., description="Search keyword")
    hashtags: list[str] = Field(default_factory=list, description="Multi hashtags")
    max_days: int = Field(7, ge=1, le=365, description="Search period (days)")
    results_per_page: int = Field(10, ge=1, le=50, description="Results per page")
    region: str = Field("US", description="Region (US, KR, JP, EU)")

class YouTubeSearchRequest(BaseModel):
    keyword: str = Field(..., description="Search term")
    sort_by: str = Field("views", description="views / date / relevance / rating")
    date_filter: str = Field("week", description="hour / today / week / month / year")
    length_filter: str = Field("under4", description="under4 / between420 / plus20")
    max_results: int = Field(20, ge=1, le=100, description="Max results")
    region: str = Field("US", description="Region (US, KR, JP, EU)")

class FacebookSearchRequest(BaseModel):
    keyword: str = Field("", description="Search keyword")
    page_url: str = Field("", description="Page URL (instead of keyword)")
    max_days: int = Field(7, ge=1, le=365, description="Search period (days)")
    include_transcript: bool = Field(False, description="Include video transcript")
    results_limit: int = Field(20, ge=1, le=100, description="Max results")
    region: str = Field("US", description="Region (US, KR, JP, EU)")

class FacebookAdsSearchRequest(BaseModel):
    query: str = Field(..., description="Advertiser / brand name")
    country: str = Field("KR", description="Country ISO code")
    ad_type: str = Field("all", description="all / political_and_issue_ads")
    active_status: str = Field("all", description="active / inactive / all")
    use_ai_analysis: bool = Field(False, description="Use Gemini AI analysis")
    max_ads: int = Field(20, ge=1, le=500, description="Max ads")
    region: str = Field("US", description="Region (US, KR, JP, EU)")


# ─── 기존 전체 검색 ──────────────────────

@router.post("", response_model=SearchResponse)
def search(req: SearchRequest):
    """소셜미디어 플랫폼에서 영상 검색 (백그라운드)"""
    task_id = uuid.uuid4().hex[:12]
    keywords = req.keywords
    platforms = req.platforms
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
    """Run a search on a single platform"""
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
                dedup_hours=1,  # 1시간 이내 재검색 허용
            )
            complete_progress(task_id)
        except Exception as e:
            complete_progress(task_id, error=str(e))
    thread = threading.Thread(target=_run, daemon=True)
    thread.start()


@router.post("/instagram")
def search_instagram(req: InstagramSearchRequest):
    """Search Instagram hashtags"""
    task_id = uuid.uuid4().hex[:12]
    _run_platform_search(
        keyword=req.keyword,
        platform="instagram",
        task_id=task_id,
        max_days=req.max_days,
        limit=req.results_limit,
        region=req.region,
    )
    return {"task_id": task_id, "status": "running", "platform": "instagram"}

@router.post("/tiktok")
def search_tiktok(req: TikTokSearchRequest):
    """Search TikTok by keyword"""
    task_id = uuid.uuid4().hex[:12]
    _run_platform_search(
        keyword=req.keyword,
        platform="tiktok",
        task_id=task_id,
        max_days=req.max_days,
        limit=req.results_per_page,
        region=req.region,
    )
    return {"task_id": task_id, "status": "running", "platform": "tiktok"}

@router.post("/youtube")
def search_youtube(req: YouTubeSearchRequest):
    """Search YouTube"""
    task_id = uuid.uuid4().hex[:12]
    _run_platform_search(
        keyword=req.keyword,
        platform="youtube",
        task_id=task_id,
        max_days=7,
        limit=req.max_results,
        region=req.region,
    )
    return {"task_id": task_id, "status": "running", "platform": "youtube"}

@router.post("/facebook")
def search_facebook(req: FacebookSearchRequest):
    """Search Facebook"""
    keyword = req.keyword or req.page_url
    if not keyword:
        raise HTTPException(400, "Enter a keyword or page URL")
    task_id = uuid.uuid4().hex[:12]
    _run_platform_search(
        keyword=keyword,
        platform="facebook",
        task_id=task_id,
        max_days=req.max_days,
        limit=req.results_limit,
        region=req.region,
    )
    return {"task_id": task_id, "status": "running", "platform": "facebook"}

@router.post("/facebook_ads")
def search_facebook_ads(req: FacebookAdsSearchRequest):
    """Search Meta Ad Library (competitor ad intelligence)"""
    task_id = uuid.uuid4().hex[:12]
    _run_platform_search(
        keyword=req.query,
        platform="facebook_ads",
        task_id=task_id,
        max_days=30,
        limit=req.max_ads,
        region=req.region,
    )
    return {"task_id": task_id, "status": "running", "platform": "facebook_ads"}


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
