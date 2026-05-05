"""
YouTube Collector — api-ninja/youtube-search-scraper
검색 전략: KEYWORD (query 필드)
query는 문자열, 배열 아님 → build_run_input 오버라이드
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class YouTubeCollector(PlatformCollector):

    def build_run_input(self, keyword: str, limit: int,
                        date_filter: Optional[str] = None,
                        hashtags: Optional[list[str]] = None,
                        **extra) -> dict:
        """YouTube는 query가 문자열 (배열 아님). maxResults 최소 20"""
        cfg = self.actor_config
        inp = dict(cfg.fixed_input)
        inp[cfg.limit_field] = max(limit, 20)  # api-ninja: maxResults >= 20
        inp[cfg.search_field] = keyword  # string, not list
        inp.update(extra)
        return inp

    def parse_item(self, raw: dict) -> Optional[dict]:
        video_id = raw.get("videoId")
        if not video_id:
            return None

        url = f"https://www.youtube.com/watch?v={video_id}"

        # thumbnail: [{url: ..., width: ..., height: ...}, ...]
        thumbnail_list = raw.get("thumbnail") or []
        thumbnail_url = thumbnail_list[0].get("url", "") if thumbnail_list else ""

        # viewCount comes as string like "79313"
        views = int(str(raw.get("viewCount", 0)).replace(",", ""))

        return {
            "platform": "youtube",
            "url": url,
            "title": (raw.get("title") or "")[:200],
            "description": (raw.get("description") or "")[:500],
            "thumbnail_url": thumbnail_url,
            "username": raw.get("channelTitle") or raw.get("channelHandle", ""),
            "likes": 0,          # api-ninja 액터는 좋아요 수 제공 안 함
            "comments": 0,       # api-ninja 액터는 댓글 수 제공 안 함
            "views": views,
            "created_at": raw.get("publishDate") or raw.get("publishedAt", ""),
        }

    # ─── Engagement thresholds ──
    def min_likes(self) -> int:
        return 0

    def min_comments(self) -> int:
        return 0

    def min_views(self) -> int:
        return 0           # 조회수는 항상 있지만 필터는 안 함
