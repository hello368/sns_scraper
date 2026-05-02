"""
라이브러리 API 라우트
"""
from __future__ import annotations
from fastapi import APIRouter, Query
from typing import Optional

from storage.repository import Repository

router = APIRouter(prefix="/library", tags=["library"])


@router.get("/stats")
def library_stats():
    """라이브러리 통계"""
    repo = Repository()
    return repo.get_library_stats()


@router.get("/videos")
def list_videos(
    category: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """영상 목록 조회"""
    repo = Repository()
    videos = repo.get_videos(
        category=category,
        platform=platform,
        limit=limit,
        offset=offset,
    )
    return {
        "total": len(videos),
        "videos": [
            {
                "id": v.id,
                "platform": v.platform,
                "title": v.title,
                "thumbnail_url": v.thumbnail_url,
                "category": v.category,
                "duration_sec": v.duration_sec,
                "filesize_bytes": v.filesize_bytes,
                "downloaded": bool(v.downloaded),
                "filepath": v.filepath,
                "relevance_score": v.relevance_score,
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
