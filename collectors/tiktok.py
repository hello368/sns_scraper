"""
TikTok Collector — clockworks/tiktok-scraper
검색 전략: KEYWORD (searchQueries 배열)
특이사항: 좋아요 10K 상한 → playCount로 필터링
         유료 필터: leastDiggs, mostDiggs, searchDatePosted, searchSorting
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class TikTokCollector(PlatformCollector):

    def parse_item(self, raw: dict) -> Optional[dict]:
        url = raw.get("webVideoUrl") or raw.get("videoUrl") or raw.get("url") or raw.get("webLink")
        if not url:
            return None
        author = raw.get("authorMeta", {}) or {}
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
            "views": raw.get("playCount", 0),                          # ✅ 정상!
            "created_at": raw.get("createTime") or raw.get("createTimeISO", ""),
        }

    def validate(self, parsed: dict) -> bool:
        if not super().validate(parsed):
            return False
        title = (parsed.get("title") or "").lower()
        if "#ad" in title or "#sponsored" in title:
            return False
        return True

    # ─── Engagement thresholds ──
    def min_likes(self) -> int:
        return 0              # 10K 상한으로 무의미 → views로 필터링

    def min_comments(self) -> int:
        return 20

    def min_views(self) -> int:
        return 10000          # 조회수 1만+
