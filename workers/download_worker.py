"""
다운로드 워커 — Pipeline Stage 2: 큐를 폴링 → 순차 다운로드
"""
from __future__ import annotations
import logging
import time
from typing import Optional

from storage.repository import Repository
from storage.downloader import Downloader
from core.errors import DiskFullError, VideoValidationError

logger = logging.getLogger(__name__)


class DownloadWorker:
    """다운로드 큐 워커 — 주기적으로 큐 확인 → 다운로드 실행"""

    def __init__(self, repo: Optional[Repository] = None,
                 downloader: Optional[Downloader] = None):
        self._repo = repo or Repository()
        self._dl = downloader or Downloader(repo=self._repo)
        self._running = False

    def process_queue(self, limit: int = 5) -> dict:
        """큐에서 pending 항목 처리"""
        pending = self._repo.get_pending_downloads(limit=limit)
        if not pending:
            return {"processed": 0, "message": "큐가 비어 있음"}

        results = {"processed": 0, "done": 0, "failed": 0, "errors": []}

        for task in pending:
            # 상태 업데이트
            self._repo.update_download(task.id, status="downloading")

            try:
                result = self._dl.download(
                    url=task.url,
                    task_id=task.id,
                    category=task.category or "",
                )

                # 성공 → DB 업데이트
                self._repo.mark_downloaded(
                    url=task.url,
                    filepath=result["filepath"],
                    filesize=result.get("filesize", 0),
                    duration=result.get("duration", 0),
                )
                self._repo.update_download(task.id, status="done")
                results["done"] += 1

            except DiskFullError as e:
                logger.error(f"디스크 Full, 큐 중단: {e}")
                self._repo.update_download(task.id, status="failed", error=str(e))
                results["failed"] += 1
                results["errors"].append(str(e))
                break  # 더 이상 진행 불가

            except (VideoValidationError, Exception) as e:
                logger.warning(f"다운로드 실패 {task.url[:60]}: {e}")
                self._repo.update_download(task.id, status="failed", error=str(e))
                results["failed"] += 1
                results["errors"].append(str(e))

            results["processed"] += 1
            # rate limit: 1초 간격
            time.sleep(1)

        return results

    def run_forever(self, interval_sec: int = 30):
        """데몬 모드: 주기적으로 큐 폴링"""
        self._running = True
        logger.info(f"다운로드 워커 시작 (interval={interval_sec}s)")
        while self._running:
            try:
                result = self.process_queue(limit=5)
                if result["processed"] > 0:
                    logger.info(f"Queue processed: {result}")
            except Exception as e:
                logger.error(f"워커 에러: {e}")
            time.sleep(interval_sec)

    def stop(self):
        self._running = False
