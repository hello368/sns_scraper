"""
DB Repository — 모든 DB CRUD를 여기서 관리
"""
from __future__ import annotations
import json
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from core.models import SearchRecord, Video, DownloadTask, SessionLocal


def video_id_from_url(url: str) -> str:
    """URL로부터 안정적인 ID 생성"""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


class Repository:
    """DB 접근 추상화 — 테스트에서 Mock으로 교체 가능"""

    def __init__(self, session: Optional[Session] = None):
        self._session = session or SessionLocal()

    def close(self):
        self._session.close()

    # ─── Search Records ─────────────────────────────────

    def already_searched(self, keyword: str, platform: str,
                          within_hours: int = 24) -> bool:
        """오늘 이미 같은 검색어+플랫폼을 검색했는지 확인"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=within_hours)
        return self._session.query(SearchRecord).filter(
            SearchRecord.keyword == keyword,
            SearchRecord.platform == platform,
            SearchRecord.created_at >= cutoff,
            SearchRecord.status == "completed",
        ).first() is not None

    def save_search(self, keyword: str, platform: str,
                    result_count: int = 0, apify_run_id: str = "",
                    cu_cost: float = 0.0, status: str = "completed",
                    error: Optional[str] = None) -> SearchRecord:
        record = SearchRecord(
            keyword=keyword, platform=platform,
            result_count=result_count, apify_run_id=apify_run_id,
            cu_cost=cu_cost, status=status, error=error,
        )
        self._session.add(record)
        self._session.commit()
        return record

    def get_recent_searches(self, limit: int = 50):
        return self._session.query(SearchRecord).order_by(
            SearchRecord.created_at.desc()
        ).limit(limit).all()

    # ─── Videos ─────────────────────────────────────────

    def video_exists(self, url: str) -> bool:
        vid = video_id_from_url(url)
        return self._session.query(Video).filter(Video.id == vid).first() is not None

    def save_video(self, url: str, platform: str, title: str = "",
                   description: str = "", thumbnail_url: str = "",
                   username: str = "", category: str = "other",
                   region: str = "US",
                   relevance_score: float = 5.0, tags: list = None) -> Video:
        vid = video_id_from_url(url)
        video = Video(
            id=vid, url=url, platform=platform, title=title[:500],
            description=description, thumbnail_url=thumbnail_url,
            username=username, category=category, region=region,
            relevance_score=relevance_score,
            tags=json.dumps(tags or []),
        )
        self._session.add(video)
        self._session.commit()
        return video

    def mark_downloaded(self, url: str, filepath: str,
                         filesize: int = 0, duration: int = 0):
        vid = video_id_from_url(url)
        video = self._session.query(Video).filter(Video.id == vid).first()
        if video:
            video.downloaded = 1
            video.filepath = filepath
            video.filesize_bytes = filesize
            video.duration_sec = duration
            video.downloaded_at = datetime.now(timezone.utc)
            self._session.commit()

    def get_videos(self, category: Optional[str] = None,
                   platform: Optional[str] = None,
                   region: Optional[str] = None,
                   downloaded: Optional[int] = None,
                   limit: int = 100, offset: int = 0):
        q = self._session.query(Video)
        if category:
            q = q.filter(Video.category == category)
        if platform:
            q = q.filter(Video.platform == platform)
        if region:
            q = q.filter(Video.region == region)
        if downloaded is not None:
            q = q.filter(Video.downloaded == downloaded)
        return q.order_by(Video.created_at.desc()).limit(limit).offset(offset).all()

    def count_videos(self, category: Optional[str] = None,
                     region: Optional[str] = None) -> int:
        q = self._session.query(Video)
        if category:
            q = q.filter(Video.category == category)
        if region:
            q = q.filter(Video.region == region)
        return q.count()

    def get_library_stats(self, region: Optional[str] = None) -> dict:
        """대시보드용 통계"""
        base = self._session.query(Video)
        if region:
            base = base.filter(Video.region == region)
        total = base.count()
        downloaded = base.filter(Video.downloaded == 1).count()
        by_category = base.with_entities(
            Video.category, func.count(Video.id)
        ).group_by(Video.category).all()
        by_platform = base.with_entities(
            Video.platform, func.count(Video.id)
        ).group_by(Video.platform).all()
        total_bytes = base.with_entities(
            func.sum(Video.filesize_bytes)
        ).filter(Video.downloaded == 1).scalar() or 0
        return {
            "total_videos": total,
            "downloaded": downloaded,
            "total_size_mb": round(total_bytes / (1024 * 1024), 1),
            "by_category": dict(by_category),
            "by_platform": dict(by_platform),
        }

    # ─── Download Queue ─────────────────────────────────

    def enqueue_download(self, url: str, platform: str = "",
                          category: str = "other") -> DownloadTask:
        vid = video_id_from_url(url)
        task = DownloadTask(video_id=vid, url=url, platform=platform, category=category)
        self._session.add(task)
        self._session.commit()
        return task

    def get_pending_downloads(self, limit: int = 10):
        return self._session.query(DownloadTask).filter(
            DownloadTask.status == "queued"
        ).order_by(DownloadTask.created_at).limit(limit).all()

    def get_running_downloads(self):
        return self._session.query(DownloadTask).filter(
            DownloadTask.status == "downloading"
        ).all()

    def update_download(self, task_id: str, status: str = None,
                         progress: float = None, filepath: str = None,
                         error: str = None):
        task = self._session.query(DownloadTask).filter(
            DownloadTask.id == task_id
        ).first()
        if not task:
            return
        if status:
            task.status = status
        if progress is not None:
            task.progress = progress
        if filepath:
            task.filepath = filepath
        if error:
            task.error = error
            task.retry_count = DownloadTask.retry_count + 1
        if status == "downloading" and not task.started_at:
            task.started_at = datetime.now(timezone.utc)
        if status == "done":
            task.completed_at = datetime.now(timezone.utc)
            task.progress = 100.0
        self._session.commit()
