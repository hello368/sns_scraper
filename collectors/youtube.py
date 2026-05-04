"""
YouTube Collector — streamers/youtube-scraper
검색 전략: URL_SEARCH (startUrls + sortingOrder)
핵심: sortingOrder="views" + dateFilter + lengthFilter
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class YouTubeCollector(PlatformCollector):

    def parse_item(self, raw: dict) -> Optional[dict]:
        url = raw.get("url") or raw.get("webLink")
        video_id = raw.get("id")
        if not url and video_id:
            url = f"https://www.youtube.com/watch?v={video_id}"
        if not url:
            return None

        return {
            "platform": "youtube",
            "url": url,
            "title": (raw.get("title") or "")[:200],
            "description": (raw.get("description") or raw.get("translatedTitle") or "")[:500],
            "thumbnail_url": raw.get("thumbnailUrl") or "",
            "username": raw.get("channelName") or raw.get("channelUsername") or "",
            "likes": raw.get("likeCount", raw.get("likes", 0)),          # ✅ 정확!
            "comments": raw.get("commentsCount", raw.get("commentCount", 0)),
            "views": raw.get("viewCount", raw.get("views", 0)),          # ✅ 정확!
            "created_at": raw.get("date") or raw.get("publishedAt") or "",
        }

    # ─── Engagement thresholds ──
    def min_likes(self) -> int:
        return 0           # streamers~youtube-scraper가 likes를 안정적으로 안 줌 → relevance_score로 대체

    def min_comments(self) -> int:
        return 0           # streamers~youtube-scraper가 댓글수 필드를 안 줌

    def min_views(self) -> int:
        return 10000       # ✅ viewCount는 안정적! 1만뷰 이상
