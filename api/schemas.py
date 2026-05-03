"""
Pydantic 스키마 — API 요청/응답 타입 정의
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    keywords: list[str] = Field(
        default=["medical spa facial", "botox injection before after",
                  "dermal filler treatment"],
        max_length=20,
    )
    platforms: list[str] = Field(
        default=["instagram", "tiktok", "facebook", "youtube"],
        max_length=10,
    )
    max_per_keyword: int = Field(default=20, ge=1, le=100)
    region: str = Field(default="US", pattern=r"^(US|JP|KR|EU)$")
    use_ai_scoring: bool = True
    # ─── 신규: 기간 제한 + engagement 필터 ──────────────
    max_days: Optional[int] = Field(
        default=30, ge=1, le=365,
        description="검색할 최대 기간 (일). 30 = 최근 30일 내 영상만.",
    )
    min_likes: Optional[int] = Field(
        default=None, ge=0,
        description="전역 최소 좋아요 오버라이드 (None = 플랫폼 기본값 사용)",
    )
    min_comments: Optional[int] = Field(
        default=None, ge=0,
        description="전역 최소 댓글 오버라이드",
    )
    min_views: Optional[int] = Field(
        default=None, ge=0,
        description="전역 최소 조회수 오버라이드",
    )


class SearchResponse(BaseModel):
    task_id: str
    status: str = "completed"
    total_found: int
    after_dedup: int
    new_videos: int
    platforms_used: list[str]


class DownloadRequest(BaseModel):
    video_ids: list[str] = Field(..., min_length=1, max_length=50)
    category: Optional[str] = None


class DownloadResponse(BaseModel):
    task_id: str
    status: str = "queued"
    queued_count: int


class LibraryQuery(BaseModel):
    category: Optional[str] = None
    platform: Optional[str] = None
    region: Optional[str] = None
    downloaded: Optional[bool] = None
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class TaskStatus(BaseModel):
    task_id: str
    status: str = "unknown"
    progress: float = 0.0
    result: Optional[dict] = None
    error: Optional[str] = None


class KeywordRequest(BaseModel):
    seeds: list[str] = Field(
        default=["medical spa", "facial", "botox", "filler"],
        min_length=1, max_length=10,
    )


class StatusResponse(BaseModel):
    status: str = "ok"
    apify_configured: bool
    deepseek_configured: bool
    total_videos: int = 0
    pending_downloads: int = 0
    disk_usage_pct: float = 0.0
