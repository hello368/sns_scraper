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
        return "streamers~youtube-scraper"

    def build_run_input(self, keyword: str, limit: int) -> dict:
        return {
            "searchKeywords": keyword,
            "maxResults": limit,
            "searchType": "video",
            "sortBy": "viewCount",  # 조회수 순 정렬 = 가장 핫한 컨텐츠
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
            "description": (raw.get("description") or raw.get("translatedTitle") or "")[:500],
            "thumbnail_url": raw.get("thumbnailUrl") or raw.get("thumbnails", [{}])[0].get("url", ""),
            "username": raw.get("channelName") or raw.get("channelUsername") or raw.get("username", ""),
            "likes": raw.get("likeCount", raw.get("likes", 0)),
            "comments": raw.get("commentsCount", raw.get("commentCount", 0)),
            "views": raw.get("viewCount", raw.get("views", 0)),
            "created_at": raw.get("date") or raw.get("publishedAt") or raw.get("createdAt", ""),
        }

    # ─── Engagement thresholds (YouTube = 중간) ──────
    def min_likes(self) -> int:
        return 10

    def min_comments(self) -> int:
        return 3

    def min_views(self) -> int:
        return 500
