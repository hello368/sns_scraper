"""
검색 API 라우트
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, HTTPException

from api.schemas import SearchRequest, SearchResponse
from core.errors import ApifyAuthError, ApifyQuotaError, ERROR_TO_STATUS
from workers.search_worker import SearchWorker

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
def search(req: SearchRequest):
    """소셜미디어 플랫폼에서 트리트먼트 영상 검색 (동기)"""
    task_id = uuid.uuid4().hex[:12]
    worker = SearchWorker()

    try:
        result = worker.run(
            keywords=req.keywords,
            platforms=req.platforms,
            max_per_keyword=req.max_per_keyword,
            region=req.region,
        )
    except (ApifyAuthError, ApifyQuotaError) as e:
        status_code = ERROR_TO_STATUS.get(type(e), 500)
        raise HTTPException(status_code, str(e), detail=getattr(e, "detail", None))
    except Exception as e:
        raise HTTPException(500, f"검색 실패: {e}")

    return SearchResponse(
        task_id=task_id,
        total_found=result.get("total_raw", 0),
        after_dedup=result.get("after_dedup", 0),
        new_videos=result.get("saved_to_db", 0),
        platforms_used=req.platforms,
    )
