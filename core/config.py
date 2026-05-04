"""
설정 — 환경 변수에서 로드, 타입 안전하게 제공
"""
from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    # ─── Paths ───────────────────────────────────────────
    base_dir: Path = Path(__file__).resolve().parent.parent
    data_dir: Path = Path(os.getenv("DATA_DIR", str(base_dir / "data" / "treatments")))

    # ─── Apify ───────────────────────────────────────────
    apify_token: str = os.getenv("APIFY_TOKEN", "")

    # ─── DeepSeek ────────────────────────────────────────
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    deepseek_model: str = "deepseek-v4-flash"
    deepseek_base_url: str = "https://api.deepseek.com"

    # ─── Platforms ───────────────────────────────────────
    # 각 액터의 상세 설정은 collectors/platform_defaults.py 참조
    apify_actors: dict = field(default_factory=lambda: {
        "instagram": "apify~instagram-hashtag-scraper",  # likesCount=0 but returns individual posts
        "tiktok": "clockworks~tiktok-scraper",
        "facebook": "apify~facebook-posts-scraper",
        "youtube": "streamers~youtube-scraper",
        "facebook_ads": "viralanalyzer~facebook-ads-library",  # ★ 신규
    })

    # ─── Categories ──────────────────────────────────────
    categories: dict = field(default_factory=lambda: {
        "facial": ["facial", "microneedling", "chemical peel", "hydrafacial"],
        "botox": ["botox", "anti-wrinkle", "dysport", "xeomin"],
        "filler": ["filler", "lip filler", "cheek filler", "jawline filler", "sculptra"],
        "medical-spa": ["medical spa", "laser", "ipl", "moxi", "bbl", "morpheus8"],
    })

    # ─── Limits ──────────────────────────────────────────
    max_results_per_keyword: int = 20
    download_concurrent: int = 3
    search_concurrent: int = 5          # 동시 Apify 호출 수
    disk_threshold_pct: int = 90        # 이 이상 차면 다운로드 중단
    max_retries: int = 3
    min_video_duration_sec: int = 5     # 5초 미만 스킵
    max_video_size_mb: int = 500        # 500MB 초과 스킵

    # ─── Cache ───────────────────────────────────────────
    search_cache_ttl_hours: int = 24    # 같은 검색어 캐싱 시간

    # ─── Seed Keywords ───────────────────────────────────
    seed_keywords: list = field(default_factory=lambda: [
        "medical spa treatment",
        "facial procedure before after",
        "botox injection demo",
        "dermal filler transformation",
        "anti wrinkle treatment results",
        "skin rejuvenation laser",
        "microneedling facial",
        "chemical peel before after",
        "lip filler journey",
        "thread lift procedure",
    ])


# 싱글톤 인스턴스
config = Config()

# Convenience: Apify/DeepSeek가 설정되었는지
apify_configured = bool(config.apify_token)
deepseek_configured = bool(config.deepseek_api_key)
