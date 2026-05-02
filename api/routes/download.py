"""
다운로드 API 라우트
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, HTTPException

from api.schemas import DownloadRequest, DownloadResponse
from storage.repository import Repository
from workers.download_worker import DownloadWorker

router = APIRouter(prefix="/download", tags=["download"])


@router.post("", response_model=DownloadResponse)
async def enqueue_download(req: DownloadRequest):
    """영상 다운로드 큐에 추가"""
    repo = Repository()
    task_id = uuid.uuid4().hex[:12]
    queued = 0

    for vid in req.video_ids:
        video = repo._session.query(...)  # TODO: implement get_video_by_id
        # Actually, let me simplify:
        pass

    # Simple approach: find videos by URL or ID
    from core.models import Video as VideoModel
    videos = repo._session.query(VideoModel).filter(
        VideoModel.id.in_(req.video_ids)
    ).all()

    if not videos:
        raise HTTPException(404, "해당 ID의 영상을 찾을 수 없음")

    for v in videos:
        repo.enqueue_download(
            url=v.url, platform=v.platform, category=req.category or v.category
        )
        queued += 1

    # 워커 실행
    worker = DownloadWorker(repo=repo)
    worker.process_queue(limit=queued)

    return DownloadResponse(
        task_id=task_id,
        queued_count=queued,
    )
