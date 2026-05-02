"""
Instagram Collector — Instagram Hashtag Scraper (Apify)
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
        return "apify~instagram-hashtag-scraper"

    def build_run_input(self, keyword: str, limit: int) -> dict:
        # 해시태그 형태로 변환 (공백 제거, # 제거)
        clean_tag = keyword.replace("#", "").replace(" ", "").strip()[:50]
        return {
            "hashtags": [clean_tag],
            "resultsLimit": limit,
        }

    def parse_item(self, raw: dict) -> Optional[dict]:
        url = raw.get("url")
        if not url:
            return None
        # Video only (Reels/Video 타입만)
        content_type = raw.get("type", "").lower()
        caption = raw.get("caption") or ""
        return {
            "platform": "instagram",
            "url": url,
            "title": caption[:200],
            "description": caption[:500],
            "thumbnail_url": raw.get("displayUrl") or raw.get("thumbnailUrl", ""),
            "username": "",  # hashtag scraper doesn't include username directly
            "likes": 0,  # not provided by this actor
            "comments": raw.get("commentsCount", 0),
            "created_at": "",
        }

    def validate(self, parsed: dict) -> bool:
        if not super().validate(parsed):
            return False
        if not parsed.get("url", "").startswith("https://"):
            return False
        return True
