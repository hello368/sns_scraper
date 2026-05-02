"""
TikTok Collector — 키워드 검색, 영상 메타데이터 포함
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
            "scrapeVideoMetadata": True,
        }

    def parse_item(self, raw: dict) -> Optional[dict]:
        url = raw.get("url") or raw.get("webLink") or raw.get("videoUrl")
        if not url:
            return None
        return {
            "platform": "tiktok",
            "url": url,
            "title": (raw.get("caption") or raw.get("desc") or raw.get("text", ""))[:200],
            "description": (raw.get("caption") or raw.get("desc", ""))[:500],
            "thumbnail_url": raw.get("thumbnailUrl") or raw.get("imageUrl", ""),
            "username": raw.get("username") or raw.get("authorMeta", {}).get("name", ""),
            "likes": raw.get("diggCount", raw.get("likeCount", 0)),
            "comments": raw.get("commentCount", 0),
            "created_at": raw.get("createTime") or raw.get("createdAt", ""),
        }

    def validate(self, parsed: dict) -> bool:
        if not super().validate(parsed):
            return False
        # 광고/프로모션 제외
        title = (parsed.get("title") or "").lower()
        if "#ad" in title or "#sponsored" in title:
            return False
        return True
