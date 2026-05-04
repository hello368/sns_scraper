"""
Facebook Ads Library Collector — viralanalyzer/facebook-ads-library 🔥
검색 전략: BRAND (searchQuery + 국가 + 확장 검색)
경쟁사 광고 인텔리전스 — 예산/노출수 데이터 획득
"""
from __future__ import annotations
from typing import Optional
from collectors.base import PlatformCollector


class FacebookAdsCollector(PlatformCollector):

    def parse_item(self, raw: dict) -> Optional[dict]:
        ad_id = raw.get("id") or raw.get("adLibraryId")
        url = raw.get("adLibraryUrl") or ""
        if not url and ad_id:
            url = f"https://www.facebook.com/ads/library/?id={ad_id}"
        if not url:
            return None

        # 노출수 중간값 계산 (예: "100,000 - 500,000" → 300000)
        impressions_raw = raw.get("impressions") or ""
        impressions_mid = self._parse_range(impressions_raw)

        # 예산 중간값
        spend_raw = raw.get("estimatedSpend") or ""
        spend_mid = self._parse_range(spend_raw)

        image_url = raw.get("imageUrl") or ""
        video_url = raw.get("videoUrl") or ""

        return {
            "platform": "facebook_ads",
            "url": url,
            "title": (raw.get("adContent") or "")[:200],
            "description": (raw.get("adContent") or "")[:500],
            "thumbnail_url": video_url or image_url,
            "username": raw.get("pageName") or "",
            "likes": 0,                    # 광고는 likes 대신
            "comments": 0,
            "views": impressions_mid,      # 노출수 중간값
            "created_at": raw.get("startDate") or "",
            "_meta": {                     # 광고 특화 메타데이터
                "estimated_spend": spend_raw,
                "impressions_range": impressions_raw,
                "ad_format": raw.get("adFormat", ""),
                "platforms": raw.get("platforms", ""),
                "page_name": raw.get("pageName", ""),
                "ad_status": raw.get("status", ""),
                "ad_content": raw.get("adContent", ""),
                "image_url": image_url,
                "video_url": video_url,
            },
        }

    @staticmethod
    def _parse_range(range_str: str) -> int:
        """'100,000 - 500,000' → 300000 (중간값)"""
        import re
        nums = re.findall(r'[\d,]+', range_str.replace(",", ""))
        if len(nums) >= 2:
            try:
                low = int(nums[0].replace(",", ""))
                high = int(nums[1].replace(",", ""))
                return (low + high) // 2
            except ValueError:
                pass
        elif len(nums) == 1:
            try:
                return int(nums[0].replace(",", ""))
            except ValueError:
                pass
        return 0

    # ─── Engagement thresholds ──
    def min_likes(self) -> int:
        return 0            # 광고는 likes가 없음

    def min_comments(self) -> int:
        return 0

    def min_views(self) -> int:
        return 100000       # 노출수 10만+ 이상 광고만
