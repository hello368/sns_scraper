"""
Instagram Collector — apify/instagram-scraper
검색 전략: HASHTAG (해시태그 검색)
변경: apify~instagram-hashtag-scraper → apify~instagram-scraper (likesCount 정상화!)
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class InstagramCollector(PlatformCollector):

    def parse_item(self, raw: dict) -> Optional[dict]:
        short_code = raw.get("shortCode")
        url = raw.get("url") or ""
        if short_code and (not url or "explore/tags" in url):
            url = f"https://www.instagram.com/p/{short_code}/"
        if not url or "explore/tags" in url:
            return None

        content_type = raw.get("type", "").lower()
        if content_type not in ("image", "video", "sidecar", ""):
            return None

        # Thumbnail fallback
        images = raw.get("images") or []
        display_resources = raw.get("displayResources") or raw.get("thumbnailResources") or []
        thumbnail = (
            raw.get("displayUrl")
            or raw.get("thumbnailUrl")
            or (images[0] if images and isinstance(images[0], str) else None)
            or (images[0].get("url") if images and isinstance(images[0], dict) else None)
            or (display_resources[-1].get("src") if display_resources else None)
            or raw.get("imageUrl")
            or raw.get("thumbnailSrc")
            or raw.get("coverUrl")
            or ""
        )

        caption = raw.get("caption") or ""
        return {
            "platform": "instagram",
            "url": url,
            "title": caption[:200],
            "description": caption[:500],
            "thumbnail_url": thumbnail,
            "username": raw.get("ownerUsername") or raw.get("username", ""),
            "likes": max(0, raw.get("likesCount", raw.get("likeCount", 0)) or 0),
            "comments": max(0, raw.get("commentsCount", raw.get("commentCount", 0)) or 0),
            "views": max(0, raw.get("videoViewCount", raw.get("viewCount", 0)) or 0),
            "created_at": raw.get("timestamp") or raw.get("createdAt", ""),
        }

    def engagement_sort_key(self, parsed: dict) -> float:
        """Instagram은 좋아요/조회수 데이터를 못 가져오므로 정렬 무의미.
        AI 스코어링 이후 relevance_score로 평가됨."""
        return 0.0

    def validate(self, parsed: dict) -> bool:
        if not super().validate(parsed):
            return False
        url = parsed.get("url", "")
        if not url.startswith("https://"):
            return False
        if "explore/tags" in url:
            return False
        return True

    # ─── Engagement thresholds ──
    def min_likes(self) -> int:
        return 0           # hashtag-scraper는 likesCount=0/-1 반환, 임계값 비활성화

    def min_comments(self) -> int:
        return 0           # hashtag-scraper는 commentsCount=0 반환

    def min_views(self) -> int:
        return 0
