"""
Facebook Collector — apify/facebook-posts-scraper
검색 전략: URL_SEARCH (startUrls + onlyPostsNewerThan)
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class FacebookCollector(PlatformCollector):

    def parse_item(self, raw: dict) -> Optional[dict]:
        url = raw.get("videoUrl") or raw.get("url") or raw.get("webLink")
        if not url:
            return None
        return {
            "platform": "facebook",
            "url": url,
            "title": (raw.get("title") or raw.get("text", ""))[:200],
            "description": (raw.get("description") or raw.get("text", ""))[:500],
            "thumbnail_url": raw.get("thumbnailUrl") or raw.get("imageUrl", ""),
            "username": raw.get("username") or raw.get("pageName", "") or raw.get("ownerFullName", ""),
            "likes": raw.get("likesCount", 0),
            "comments": raw.get("commentsCount", 0),
            "views": raw.get("viewCount", raw.get("views", 0)),
            "created_at": raw.get("createdAt") or raw.get("timestamp", ""),
        }

    # ─── Engagement thresholds ──
    def min_likes(self) -> int:
        return 1000

    def min_comments(self) -> int:
        return 50

    def min_views(self) -> int:
        return 50000
