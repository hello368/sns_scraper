"""
플랫폼 컬렉터 추상 클래스 — Config-Driven 공통 로직 포함
"""
from __future__ import annotations
import re
from abc import ABC, abstractmethod
from typing import Optional

from collectors.platform_defaults import (
    ActorConfig, SearchStrategy, get_config, build_search_url
)


class PlatformCollector(ABC):
    """각 소셜미디어 플랫폼의 검색 전략 — Config-Driven"""

    def __init__(self):
        self._config: Optional[ActorConfig] = None

    @property
    def name(self) -> str:
        """플랫폼명 — 서브클래스에서 오버라이드하거나 config에서 추론"""
        return self._detect_name()

    def _detect_name(self) -> str:
        """클래스명에서 플랫폼명 추론"""
        name = type(self).__name__.lower()
        mapping = {
            "instagramcollector": "instagram",
            "tiktokcollector": "tiktok",
            "youtubecollector": "youtube",
            "facebookcollector": "facebook",
            "facebookadscollector": "facebook_ads",
        }
        return mapping.get(name, "unknown")

    @property
    def actor_config(self) -> ActorConfig:
        """이 플랫폼의 액터 설정"""
        if self._config is None:
            self._config = get_config(self.name)
        return self._config

    @property
    def apify_actor(self) -> str:
        return self.actor_config.actor_id

    # ─── 공통 인풋 빌더 ────────────────────────────

    def build_run_input(self, keyword: str, limit: int,
                        date_filter: Optional[str] = None,
                        hashtags: Optional[list[str]] = None,
                        **extra) -> dict:
        """Config 템플릿 기반 인풋 생성

        Args:
            keyword: 검색어
            limit: 결과 수 제한
            date_filter: 기간 필터값 (예: "7 days", "week", "2026-04-01")
            hashtags: 멀티 해시태그 (지원하는 플랫폼만)
            extra: 추가 오버라이드 파라미터
        """
        cfg = self.actor_config
        inp = dict(cfg.fixed_input)
        inp[cfg.limit_field] = limit

        # 검색어 주입
        if cfg.search_strategy == SearchStrategy.HASHTAG:
            # Instagram hashtag-scraper: 해시태그 배열 필요, 공백/특수문자 제거
            clean = keyword.replace("#", "").strip()
            clean = re.sub(r"[^a-zA-Z0-9_]", "", clean)  # 알파벳+숫자+언더바만
            if hashtags and cfg.has_multi_hashtag and cfg.hashtag_field:
                inp[cfg.hashtag_field] = hashtags
            else:
                inp[cfg.search_field] = [clean]

        elif cfg.search_strategy == SearchStrategy.KEYWORD:
            # TikTok: 배열로 전달 (searchQueries)
            inp[cfg.search_field] = [keyword]
            # 멀티 해시태그
            if hashtags and cfg.has_multi_hashtag and cfg.hashtag_field:
                inp[cfg.hashtag_field] = hashtags

        elif cfg.search_strategy == SearchStrategy.URL_SEARCH:
            # YouTube/Facebook: 검색 URL 생성
            url = build_search_url(self.name, keyword)
            inp["startUrls"] = [{"url": url}]

        elif cfg.search_strategy == SearchStrategy.BRAND:
            # FB Ads: 첫 번째 확장 키워드로 검색
            # (search_worker에서 여러 번 호출하여 각 확장 검색)
            inp[cfg.search_field] = keyword

        # 기간 필터 주입
        if date_filter and cfg.has_date_filter and cfg.date_field:
            inp[cfg.date_field] = date_filter

        # 추가 오버라이드
        inp.update(extra)

        return inp

    def get_search_expansions(self, keyword: str) -> list[str]:
        """BRAND 전략용: 확장 검색어 목록"""
        from collectors.platform_defaults import get_search_expansions
        return get_search_expansions(self.name, keyword)

    # ─── 응답 파싱 (서브클래스 구현) ──────────────

    @abstractmethod
    def parse_item(self, raw: dict) -> Optional[dict]:
        """Apify 응답의 한 아이템을 표준 형식으로 변환"""

    def validate(self, parsed: dict) -> bool:
        """결과 유효성 검사 (오버라이드 가능)"""
        return bool(parsed.get("url"))

    def engagement_sort_key(self, parsed: dict) -> float:
        """Engagement score — 높을수록 인기 영상"""
        likes = int(parsed.get("likes", 0) or 0)
        comments = int(parsed.get("comments", 0) or 0)
        views = int(parsed.get("views", 0) or 0)
        return likes + comments * 3 + views * 0.01

    # ─── Engagement thresholds (각 플랫폼에서 오버라이드) ──

    def min_likes(self) -> int:
        return 0

    def min_comments(self) -> int:
        return 0

    def min_views(self) -> int:
        return 0

    def meets_engagement_threshold(self, parsed: dict) -> bool:
        """Engagement 최소 조건 검사"""
        likes = int(parsed.get("likes", 0) or 0)
        comments = int(parsed.get("comments", 0) or 0)
        views = int(parsed.get("views", 0) or 0)
        if self.min_likes() > 0 and likes < self.min_likes():
            return False
        if self.min_comments() > 0 and comments < self.min_comments():
            return False
        if self.min_views() > 0 and views < self.min_views():
            return False
        return True

    def extract_url(self, raw: dict) -> str:
        return raw.get("url") or raw.get("webLink") or ""


# 표준 응답 형식
STANDARD_FIELDS = [
    "platform", "url", "title", "description",
    "thumbnail_url", "username", "likes", "comments",
    "created_at",
]
