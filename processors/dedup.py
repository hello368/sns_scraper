"""
중복 제거기 — 이미 DB에 있거나 오늘 검색한 URL은 제외
"""
from __future__ import annotations
import logging

from storage.repository import Repository

logger = logging.getLogger(__name__)


class Deduplicator:
    """검색 결과에서 중복 URL 제거"""

    def __init__(self, repo: Repository | None = None):
        self._repo = repo or Repository()

    def dedup(self, results: list[dict]) -> list[dict]:
        """이미 DB에 있는 URL 제거 (안전망 — _execute_search에서도 1차 체크함)"""
        seen = set()
        keep = []
        skipped_existing = 0
        skipped_recent = 0

        for item in results:
            url = item.get("url", "")
            if not url or url in seen:
                continue
            seen.add(url)

            # 이미 DB에 있는 영상인가?
            if self._repo.video_exists(url):
                skipped_existing += 1
                continue

            keep.append(item)

        if skipped_existing or skipped_recent:
            logger.info(
                f"Dedup: kept {len(keep)}, skipped {skipped_existing} existing"
            )
        return keep
