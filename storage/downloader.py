"""
yt-dlp 기반 영상 다운로더 — 유효성 검사 + 디스크 체크 포함
"""
from __future__ import annotations
import logging
import shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Optional

import yt_dlp

from core.config import config
from core.errors import DiskFullError, DownloadError, VideoValidationError
from storage.repository import Repository
from processors.classifier import Classifier

logger = logging.getLogger(__name__)


def _check_disk_space() -> None:
    """디스크 여유 공간 확인. 90% 이상이면 중단"""
    total, used, free = shutil.disk_usage(config.data_dir)
    pct_used = (used / total) * 100
    if pct_used >= config.disk_threshold_pct:
        raise DiskFullError(
            f"디스크 {pct_used:.0f}% 사용 중 (임계: {config.disk_threshold_pct}%)",
        )


def _validate_video(filepath: Path, info: dict) -> None:
    """다운로드된 파일 유효성 검사"""
    if not filepath.exists() or filepath.stat().st_size == 0:
        raise VideoValidationError(f"파일이 비어 있음: {filepath}")

    duration = info.get("duration", 0) or 0
    if 0 < duration < config.min_video_duration_sec:
        filepath.unlink(missing_ok=True)
        raise VideoValidationError(
            f"영상 너무 짧음: {duration}초 (최소 {config.min_video_duration_sec}초)"
        )

    size_mb = filepath.stat().st_size / (1024 * 1024)
    if size_mb > config.max_video_size_mb:
        filepath.unlink(missing_ok=True)
        raise VideoValidationError(
            f"영상 너무 큼: {size_mb:.0f}MB (최대 {config.max_video_size_mb}MB)"
        )


class Downloader:
    """영상 다운로드 + 유효성 검사"""

    def __init__(self, repo: Optional[Repository] = None,
                 classifier: Optional[Classifier] = None,
                 progress_callback: Optional[Callable] = None):
        self._repo = repo or Repository()
        self._classifier = classifier or Classifier()
        self._progress_callback = progress_callback

    def download(self, url: str, task_id: str = "",
                 category: str = "") -> dict:
        """단일 영상 다운로드"""
        _check_disk_space()

        if not category:
            category = "other"

        output_dir = config.data_dir / category
        output_dir.mkdir(parents=True, exist_ok=True)

        # 파일명: 플랫폼_날짜_해시
        template = str(output_dir / "%(extractor)s_%(id)s.%(ext)s")
        info_path = output_dir / "metadata"

        ydl_opts = {
            "format": "best[height<=1080][ext=mp4]/best[height<=1080]/best",
            "outtmpl": template,
            "quiet": True,
            "no_warnings": True,
            "writedescription": True,
            "writeinfojson": True,
            "ignoreerrors": True,
            "retries": config.max_retries,
            "fragment_retries": config.max_retries,
            "socket_timeout": 30,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 진행률 후킹
                if self._progress_callback and task_id:
                    ydl.add_progress_hook(
                        lambda s: self._on_progress(s, task_id)
                    )

                info = ydl.extract_info(url, download=True)
                if info is None:
                    raise DownloadError("yt-dlp: 정보를 가져올 수 없음")

                # 실제 파일 경로 찾기
                filepath_str = ydl.prepare_filename(info)
                filepath = Path(filepath_str)

                # 확장자 보정 (yt-dlp가 실제 확장자로 바꿀 수 있음)
                if not filepath.exists():
                    # extractor_id_id.ext 형식으로 fallback
                    ext = info.get("ext", "mp4")
                    filepath = output_dir / f"{info.get('extractor','')}_{info.get('id','')}.{ext}"
                    if not filepath.exists():
                        # 글로브 검색
                        matches = list(output_dir.glob(f"*{info.get('id','')}*"))
                        filepath = matches[0] if matches else filepath

                # 유효성 검사
                _validate_video(filepath, info)

                return {
                    "url": url,
                    "task_id": task_id,
                    "status": "done",
                    "filepath": str(filepath),
                    "title": info.get("title", ""),
                    "duration": info.get("duration", 0),
                    "filesize": filepath.stat().st_size,
                    "resolution": f"{info.get('width', '?')}x{info.get('height', '?')}",
                    "category": category,
                }

        except (DiskFullError, VideoValidationError):
            raise
        except Exception as e:
            raise DownloadError(f"다운로드 실패: {e}") from e

    def download_batch(self, items: list[dict]) -> list[dict]:
        """여러 영상 동시 다운로드"""
        results = []
        with ThreadPoolExecutor(max_workers=config.download_concurrent) as ex:
            futures = {}
            for item in items:
                url = item["url"]
                task_id = item.get("task_id", "")
                category = item.get("category", "")
                # AI 분류
                if not category:
                    title = item.get("title", "")
                    desc = item.get("description", "")
                    cat_result = self._classifier.classify(title, desc)
                    category = cat_result.get("category", "other")

                future = ex.submit(self.download, url, task_id, category)
                futures[future] = {"url": url, "task_id": task_id}

            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                    logger.info(f"✅ {result.get('title','')[:50]} → {result.get('category','')}")
                except Exception as e:
                    meta = futures[future]
                    results.append({
                        "url": meta["url"],
                        "status": "failed",
                        "error": str(e),
                    })
                    logger.error(f"❌ {meta['url'][:60]}: {e}")

        return results

    def _on_progress(self, status: dict, task_id: str):
        """yt-dlp 진행률 콜백"""
        if status.get("status") == "downloading" and self._repo:
            total = status.get("total_bytes") or status.get("total_bytes_estimate", 0)
            downloaded = status.get("downloaded_bytes", 0)
            pct = (downloaded / total * 100) if total > 0 else 0
            self._repo.update_download(task_id, progress=round(pct, 1))
