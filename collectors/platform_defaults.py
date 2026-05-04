"""
플랫폼별 액터 설정 — 각 액터의 실제 인풋 스펙에 맞춘 템플릿
"""
from __future__ import annotations
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum


class SearchStrategy(Enum):
    """검색 전략 — 각 액터의 검색 엔진 방식"""
    HASHTAG = "hashtag"        # Instagram: 해시태그 검색
    KEYWORD = "keyword"         # TikTok: 자유 키워드 검색
    URL_SEARCH = "url_search"   # YouTube/FB: 검색 URL 기반
    BRAND = "brand"             # FB Ads Library: 브랜드/광고주명 검색


@dataclass
class ActorConfig:
    """개별 액터 설정"""
    actor_id: str                         # Apify 액터 ID (예: apify~instagram-scraper)
    search_strategy: SearchStrategy       # 검색 전략
    search_field: Optional[str] = None    # 검색어를 주입할 필드명 (None=startUrls 사용)
    limit_field: str = "resultsLimit"     # 결과 수 제한 필드명
    default_limit: int = 20               # 기본 결과 수
    fixed_input: dict = field(default_factory=dict)  # 고정 인풋 파라미터
    keyword_expansions: list = field(default_factory=list)  # BRAND 전략용 키워드 확장 규칙
    has_date_filter: bool = False         # 기간 설정 지원 여부
    date_field: Optional[str] = None      # 기간 필드명
    date_supports_relative: bool = False  # 상대값 지원 ("7 days")
    has_multi_hashtag: bool = False       # 멀티 해시태그 지원 여부
    hashtag_field: Optional[str] = None   # 해시태그 필드명
    paid_filters: list = field(default_factory=list)  # 유료 필터 목록


# ─── 액터별 설정 ─────────────────────────────────────

ACTOR_CONFIGS: dict[str, ActorConfig] = {
    "instagram": ActorConfig(
        actor_id="apify~instagram-hashtag-scraper",
        search_strategy=SearchStrategy.HASHTAG,
        search_field="hashtags",
        limit_field="resultsLimit",
        default_limit=20,
        fixed_input={
            "shouldDownloadVideos": False,
            "shouldDownloadCovers": False,
        },
        has_date_filter=True,
        date_field="onlyPostsNewerThan",
        date_supports_relative=True,
        has_multi_hashtag=True,
        hashtag_field="hashtags",
        paid_filters=[],
    ),
    "tiktok": ActorConfig(
        actor_id="clockworks~tiktok-scraper",
        search_strategy=SearchStrategy.KEYWORD,
        search_field="searchQueries",                # ← 복수형! 배열로 여러 검색어 가능
        limit_field="resultsPerPage",               # ← 수정됨!
        default_limit=10,
        fixed_input={},
        has_date_filter=True,
        date_field="oldestPostDateUnified",          # ← 상대값/절대값 모두 지원
        date_supports_relative=True,
        has_multi_hashtag=True,
        hashtag_field="hashtags",                    # 배열
        paid_filters=[                               # 💵 유료 필터
            "leastDiggs", "mostDiggs",
            "searchDatePosted", "searchSorting",
            "newestPostDate",
        ],
    ),
    "youtube": ActorConfig(
        actor_id="streamers~youtube-scraper",
        search_strategy=SearchStrategy.URL_SEARCH,
        search_field=None,                           # startUrls 사용
        limit_field="maxResults",
        default_limit=20,
        fixed_input={
            "sortingOrder": "views",                 # ← 조회수순 정렬!
            "lengthFilter": "under4",                # ← 4분 미만 = 숏폼!
        },
        has_date_filter=True,
        date_field="dateFilter",                     # ← "week", "month", "year" 등
        date_supports_relative=False,                 # enum 방식: hour/today/week/month/year
        has_multi_hashtag=False,
        paid_filters=[],
    ),
    "facebook": ActorConfig(
        actor_id="apify~facebook-posts-scraper",
        search_strategy=SearchStrategy.URL_SEARCH,
        search_field=None,
        limit_field="resultsLimit",
        default_limit=20,
        fixed_input={
            "scrapePosts": True,
            "scrapeVideo": True,
            "captionText": False,
        },
        has_date_filter=True,
        date_field="onlyPostsNewerThan",             # ← "7 days" 지원
        date_supports_relative=True,
        has_multi_hashtag=False,
        paid_filters=[],
    ),
    "facebook_ads": ActorConfig(
        actor_id="viralanalyzer~facebook-ads-library",
        search_strategy=SearchStrategy.BRAND,
        search_field="searchQuery",
        limit_field="maxAds",
        default_limit=20,                            # 테스트용 20, 확장시 100
        fixed_input={
            "country": "KR",
            "adType": "all",
            "activeStatus": "all",
            "includeAiAnalysis": False,
        },
        keyword_expansions=[
            lambda kw: kw,                           # 원본
            lambda kw: f"{kw} before after",         # "skin tightening before after"
            lambda kw: f"{kw} treatment",            # "skin tightening treatment"
            lambda kw: f"{kw} results",              # "skin tightening results"
            lambda kw: f"{kw} near me",              # "skin tightening near me"
        ],
        has_date_filter=False,                       # Ad Library는 인풋에 날짜필터 없음
        has_multi_hashtag=False,
        paid_filters=[],
    ),
}


def get_config(platform: str) -> ActorConfig:
    """플랫폼명으로 액터 설정 조회"""
    cfg = ACTOR_CONFIGS.get(platform)
    if not cfg:
        raise ValueError(f"Unknown platform: {platform}")
    return cfg


def build_search_url(platform: str, keyword: str) -> str:
    """검색 URL 생성 (URL_SEARCH 전략용)"""
    from urllib.parse import quote
    encoded = quote(keyword)
    urls = {
        "youtube": f"https://www.youtube.com/results?search_query={encoded}",
        "facebook": f"https://www.facebook.com/search/videos/?q={encoded}",
    }
    url = urls.get(platform)
    if not url:
        raise ValueError(f"No search URL builder for platform: {platform}")
    return url


def get_search_expansions(platform: str, keyword: str) -> list[str]:
    """BRAND 전략용: 확장된 검색어 목록 반환"""
    cfg = get_config(platform)
    if cfg.search_strategy != SearchStrategy.BRAND:
        return [keyword]
    return [fn(keyword) for fn in cfg.keyword_expansions]
