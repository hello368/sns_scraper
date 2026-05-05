"""
TikTok Collector — clockworks/tiktok-scraper
검색 전략: KEYWORD (searchQueries 배열)
특이사항: webVideoUrl 누락 시 authorMeta.name + id로 URL 조합
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class TikTokCollector(PlatformCollector):

    def parse_item(self, raw: dict) -> Optional[dict]:
        author = raw.get("authorMeta", {}) or {}
        name = author.get("name", "")
        video_id = raw.get("id", "")

        # webVideoUrl이 있으면 사용, 없으면 author + id로 URL 조합
        url = (
            raw.get("webVideoUrl")
            or raw.get("videoUrl")
            or raw.get("url")
            or raw.get("webLink")
            or (f"https://www.tiktok.com/@{name}/video/{video_id}" if name and video_id else None)
        )
        if not url:
            return None

        video_meta = raw.get("videoMeta", {}) or {}
        slideshow_links = raw.get("slideshowImageLinks") or []

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
            "likes": raw.get("diggCount", raw.get("likeCount", 0)),    # 10K 상한
            "comments": raw.get("commentCount", 0),
            "views": raw.get("playCount", 0),
            "created_at": raw.get("createTime") or raw.get("createTimeISO", ""),
        }

    def validate(self, parsed: dict) -> bool:
        if not super().validate(parsed):
            return False
        title = (parsed.get("title") or "").lower()
        if "#ad" in title or "#sponsored" in title:
            return False
        return True

    def min_likes(self) -> int:
        return 0

    def min_comments(self) -> int:
        return 0

    def min_views(self) -> int:
        return 100  # TikTok은 바이럴 플랫폼, 100뷰 이하는 제외
