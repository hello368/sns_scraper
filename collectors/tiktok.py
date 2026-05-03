"""
TikTok Collector — 키워드 검색, 영상 메타데이터 포함
TikTok은 모든 플랫폼 중 engagement가 가장 높음
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class TikTokCollector(PlatformCollector):

    @property
    def name(self) -> str:
        return "tiktok"

    @property
    def apify_actor(self) -> str:
        return "clockworks~tiktok-scraper"

    def build_run_input(self, keyword: str, limit: int) -> dict:
        return {
            "searchQueries": [keyword],
            "resultsLimit": limit,
            "maxResults": limit,
            "scrapeVideoMetadata": True,
        }

    def parse_item(self, raw: dict) -> Optional[dict]:
        url = raw.get("webVideoUrl") or raw.get("videoUrl") or raw.get("url") or raw.get("webLink")
        if not url:
            return None
        author = raw.get("authorMeta", {}) or {}
        video_meta = raw.get("videoMeta", {}) or {}
        slideshow_links = raw.get("slideshowImageLinks") or []

        # Thumbnail: 여러 fallback 시도
        thumbnail = (
            video_meta.get("coverUrl")
            or raw.get("coverUrl")
            or raw.get("thumbnailUrl")
            or raw.get("imageUrl")
            or (slideshow_links[0].get("tiktokLink") if slideshow_links else None)
            or author.get("avatar")
            or ""
        )

        return {
            "platform": "tiktok",
            "url": url,
            "title": (raw.get("text") or raw.get("desc", ""))[:200],
            "description": (raw.get("text") or raw.get("desc", ""))[:500],
            "thumbnail_url": thumbnail,
            "username": author.get("name", raw.get("username", "")),
            "likes": raw.get("diggCount", raw.get("likeCount", 0)),
            "comments": raw.get("commentCount", 0),
            "views": raw.get("playCount", 0),
            "created_at": raw.get("createTime") or raw.get("createTimeISO", ""),
        }

    def validate(self, parsed: dict) -> bool:
        if not super().validate(parsed):
            return False
        # 광고/프로모션 제외
        title = (parsed.get("title") or "").lower()
        if "#ad" in title or "#sponsored" in title:
            return False
        return True

    # ─── Engagement thresholds (TikTok = 높은 편) ──────
    def min_likes(self) -> int:
        return 100

    def min_comments(self) -> int:
        return 10

    def min_views(self) -> int:
        return 1000
