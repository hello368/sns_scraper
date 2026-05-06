"""
라이브러리 API 라우트
"""
from __future__ import annotations
from fastapi import APIRouter, Query
from typing import Optional

from storage.repository import Repository

router = APIRouter(prefix="/library", tags=["library"])


@router.get("/stats")
def library_stats(region: Optional[str] = Query(None)):
    """라이브러리 통계"""
    repo = Repository()
    return repo.get_library_stats(region=region)


@router.get("/videos")
def list_videos(
    category: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at", pattern=r"^(created_at|likes|comments|views|relevance_score)$"),
    sort_order: str = Query("desc", pattern=r"^(asc|desc)$"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """영상 목록 조회 (정렬 + 필터 + 검색)"""
    repo = Repository()
    videos = repo.get_videos(
        category=category,
        platform=platform,
        region=region,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )
    total_count = repo.count_videos(
        category=category,
        region=region,
        search=search,
    )
    return {
        "total": total_count,
        "videos": [
            {
                "id": v.id,
                "url": v.url,
                "platform": v.platform,
                "title": v.title,
                "description": v.description,
                "thumbnail_url": v.thumbnail_url,
                "username": v.username,
                "category": v.category,
                "region": v.region or "US",
                "likes": v.likes or 0,
                "comments": v.comments or 0,
                "views": v.views or 0,
                "duration_sec": v.duration_sec or 0,
                "filesize_bytes": v.filesize_bytes or 0,
                "downloaded": bool(v.downloaded),
                "filepath": v.filepath or "",
                "relevance_score": v.relevance_score or 5.0,
                "created_at": str(v.created_at)[:19] if v.created_at else "",
            }
            for v in videos
        ],
    }


@router.get("/recent-searches")
def recent_searches(limit: int = Query(20, ge=1, le=100)):
    """최근 검색 이력"""
    repo = Repository()
    records = repo.get_recent_searches(limit=limit)
    return {
        "searches": [
            {
                "keyword": r.keyword,
                "platform": r.platform,
                "result_count": r.result_count,
                "cu_cost": r.cu_cost,
                "status": r.status,
                "created_at": str(r.created_at)[:19] if r.created_at else "",
            }
            for r in records
        ]
    }
