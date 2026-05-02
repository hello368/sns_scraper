"""
YouTube Collector — Apify YouTube Scraper 연동
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class YouTubeCollector(PlatformCollector):

    @property
    def name(self) -> str:
        return "youtube"

    @property
    def apify_actor(self) -> str:
        return "bernardo~youtube-scraper"

    def build_run_input(self, keyword: str, limit: int) -> dict:
        return {
            "searchKeywords": keyword,
            "maxResults": limit,
            "searchType": "video",
        }

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
            "description": (raw.get("description") or "")[:500],
            "thumbnail_url": raw.get("thumbnailUrl") or raw.get("thumbnails", [{}])[0].get("url", ""),
            "username": raw.get("channelName") or raw.get("username", ""),
            "likes": raw.get("likeCount", 0),
            "comments": raw.get("commentCount", 0),
            "created_at": raw.get("publishedAt") or raw.get("createdAt", ""),
        }
