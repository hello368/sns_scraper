"""
검색 API 라우트 — 비동기 실행 + 진행 상황
"""
from __future__ import annotations
import uuid
import threading
from fastapi import APIRouter, HTTPException

from api.schemas import SearchRequest, SearchResponse
from core.errors import ApifyAuthError, ApifyQuotaError, ERROR_TO_STATUS
from workers.search_worker import SearchWorker
from workers.progress import (
    create_progress, get_progress, complete_progress, request_stop,
)

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
def search(req: SearchRequest):
    """소셜미디어 플랫폼에서 영상 검색 (백그라운드)"""
    task_id = uuid.uuid4().hex[:12]
    keywords = req.keywords
    platforms = req.platforms
    max_per_keyword = req.max_per_keyword
    region = req.region

    # 진행 상황 초기화
    total_steps = len(keywords) * len(platforms)
    create_progress(task_id, total_steps)

    # 백그라운드 실행
    def _run():
        worker = SearchWorker()
        try:
            result = worker.run(
                keywords=keywords,
                platforms=platforms,
                max_per_keyword=max_per_keyword,
                region=region,
                task_id=task_id,
                # ─── 신규 파라미터 ──────────────
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


@router.get("/progress/{task_id}")
def search_progress(task_id: str):
    """검색 진행 상황 조회"""
    p = get_progress(task_id)
    if not p:
        raise HTTPException(404, f"Task {task_id} not found")
    return p


@router.post("/stop/{task_id}")
def stop_search(task_id: str):
    """검색 중단 요청 — 중단 시점까지 수집된 결과는 DB에 저장됨"""
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
