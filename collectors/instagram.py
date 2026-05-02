"""
Instagram Collector — Reels 중심, 키워드 검색
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class InstagramCollector(PlatformCollector):

    @property
    def name(self) -> str:
        return "instagram"

    @property
    def apify_actor(self) -> str:
        return "apify~instagram-scraper"

    def build_run_input(self, keyword: str, limit: int) -> dict:
        return {
            "searchType": "keyword",
            "searchQueries": [keyword],
            "resultsLimit": limit,
            "scrapeReels": True,
            "scrapePosts": False,        # Reels만
            "scrapeStories": False,
        }

    def parse_item(self, raw: dict) -> Optional[dict]:
        url = raw.get("videoUrl") or raw.get("url") or raw.get("webLink")
        if not url:
            return None
        return {
            "platform": "instagram",
            "url": url,
            "title": (raw.get("caption") or "")[:200],
            "description": (raw.get("caption") or "")[:500],
            "thumbnail_url": raw.get("thumbnailUrl") or raw.get("imageUrl", ""),
            "username": raw.get("username") or raw.get("ownerFullName", ""),
            "likes": raw.get("likesCount", 0),
            "comments": raw.get("commentsCount", 0),
            "created_at": raw.get("createdAt") or raw.get("timestamp", ""),
        }

    def validate(self, parsed: dict) -> bool:
        """광고와 비릴스 제외"""
        if not super().validate(parsed):
            return False
        title = (parsed.get("title") or "").lower()
        if "ad" in title or "sponsored" in title or "promo" in title:
            return False
        if not parsed.get("url", "").startswith("https://"):
            return False
        return True
