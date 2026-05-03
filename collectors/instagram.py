"""
Instagram Collector — Instagram Hashtag Scraper (Apify)
참고: 해시태그 검색기는 likesCount가 항상 0 (빠른 검색 한계)
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
        # URL 우선: shortCode가 있으면 올바른 post URL로 보정
        short_code = raw.get("shortCode")
        url = raw.get("url") or ""
        if short_code and (not url or "explore/tags" in url):
            url = f"https://www.instagram.com/p/{short_code}/"
        if not url or "explore/tags" in url:
            return None  # 진짜 포스트 URL이 아니면 스킵

        # 해시태그 검색기는 type이 "Image"나 "Sidecar"만 나옴 (Reels는 안 긁음)
        content_type = raw.get("type", "").lower()
        if content_type not in ("image", "video", "sidecar", ""):
            return None

        # Thumbnail: 여러 fallback 시도
        images = raw.get("images") or []
        thumbnail = (
            raw.get("displayUrl")
            or raw.get("thumbnailUrl")
            or (images[0] if images and isinstance(images[0], str) else None)
            or (images[0].get("url") if images and isinstance(images[0], dict) else None)
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
            "likes": raw.get("likesCount", raw.get("likeCount", 0)),
            "comments": raw.get("commentsCount", raw.get("commentCount", 0)),
            "views": raw.get("videoViewCount", raw.get("viewCount", 0)),
            "created_at": raw.get("timestamp") or raw.get("createdAt", ""),
        }

    def validate(self, parsed: dict) -> bool:
        if not super().validate(parsed):
            return False
        url = parsed.get("url", "")
        if not url.startswith("https://"):
            return False
        # 실제 포스트 URL만 허용 (explore/tags/ 검색 URL 제외)
        if "explore/tags" in url:
            return False
        return True

    def engagement_sort_key(self, parsed: dict) -> float:
        """Instagram 해시태그 검색기는 likes/views가 0이므로,
        comments 위주로 정렬하고 caption 길이도 보너스"""
        likes = int(parsed.get("likes", 0) or 0)
        comments = int(parsed.get("comments", 0) or 0)
        views = int(parsed.get("views", 0) or 0)
        caption_bonus = len(parsed.get("title", "") or "") * 0.1
        return likes + comments * 3 + views * 0.01 + caption_bonus

    # ─── Engagement thresholds (IG 해시태그는 likes/views 불안정) ──
    def min_likes(self) -> int:
        return 0  # 해시태그 검색기에서 likesCount가 항상 0

    def min_comments(self) -> int:
        return 5  # 댓글 5개 이상만 의미 있음

    def min_views(self) -> int:
        return 0  # views도 unreliable
