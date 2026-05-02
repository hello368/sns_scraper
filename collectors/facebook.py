"""
Facebook Collector — Facebook Posts Scraper (Apify)
키워드 → Facebook 검색 URL로 변환하여 검색
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class FacebookCollector(PlatformCollector):

    @property
    def name(self) -> str:
        return "facebook"

    @property
    def apify_actor(self) -> str:
        return "apify~facebook-posts-scraper"

    def build_run_input(self, keyword: str, limit: int) -> dict:
        # Facebook 검색 URL 구성 (video search)
        search_url = f"https://www.facebook.com/search/videos/?q={keyword.replace(' ', '+')}"
        return {
            "startUrls": [{"url": search_url}],
            "resultsLimit": limit,
            "scrapePosts": True,
            "scrapeVideo": True,
        }

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
            "created_at": raw.get("createdAt") or raw.get("timestamp", ""),
        }
