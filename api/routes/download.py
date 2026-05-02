"""
다운로드 API 라우트 — 큐 등록 + 파일 서빙
"""
from __future__ import annotations
import uuid
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from api.schemas import DownloadRequest, DownloadResponse
from storage.repository import Repository

router = APIRouter(prefix="/download", tags=["download"])


@router.post("", response_model=DownloadResponse)
async def enqueue_download(req: DownloadRequest):
    """영상 다운로드 큐에 추가 → yt-dlp 실행"""
    from core.models import Video as VideoModel

    repo = Repository()
    task_id = uuid.uuid4().hex[:12]

    videos = repo._session.query(VideoModel).filter(
        VideoModel.id.in_(req.video_ids)
    ).all()

    if not videos:
        repo.close()
        raise HTTPException(404, "해당 ID의 영상을 찾을 수 없음")

    for v in videos:
        repo.enqueue_download(
            url=v.url, platform=v.platform, category=req.category or v.category,
        )

    # 워커 실행 (yt-dlp)
    from workers.download_worker import DownloadWorker
    worker = DownloadWorker(repo=repo)
    worker.process_queue(limit=len(videos))
    repo.close()

    return DownloadResponse(
        task_id=task_id,
        queued_count=len(videos),
    )


@router.get("/file/{video_id}")
async def serve_file(video_id: str):
    """다운로드된 파일을 HTTP로 스트리밍"""
    from core.models import Video as VideoModel
    from core.config import config

    repo = Repository()
    video = repo._session.query(VideoModel).filter(
        VideoModel.id == video_id
    ).first()
    repo.close()

    if not video:
        raise HTTPException(404, "Video not found")
    if not video.downloaded or not video.filepath:
        raise HTTPException(404, "Video not downloaded yet")
    if not os.path.isfile(video.filepath):
        raise HTTPException(404, "File not found on disk")

    filename = Path(video.filepath).name
    return FileResponse(
        path=video.filepath,
        filename=filename,
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
