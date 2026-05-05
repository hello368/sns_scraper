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

    # ─── Scorer (LLM) ────────────────────────────────────
    # 우선순위: OPENROUTER_API_KEY > DEEPSEEK_API_KEY
    scorer_api_key: str = os.getenv("OPENROUTER_API_KEY") or os.getenv("DEEPSEEK_API_KEY") or ""
    scorer_model: str = os.getenv("SCORING_MODEL") or os.getenv("DEEPSEEK_MODEL") or "deepseek-v4-flash"
    scorer_base_url: str = os.getenv("SCORING_BASE_URL") or os.getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"
    using_openrouter: bool = bool(os.getenv("OPENROUTER_API_KEY"))

    # ─── Platforms ───────────────────────────────────────
    # 각 액터의 상세 설정은 collectors/platform_defaults.py 참조
    apify_actors: dict = field(default_factory=lambda: {
        "tiktok": "clockworks~tiktok-scraper",
        "youtube": "streamers~youtube-scraper",
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
    search_concurrent: int = 5
    disk_threshold_pct: int = 90
    max_retries: int = 3
    min_video_duration_sec: int = 5
    max_video_size_mb: int = 500

    # ─── Cache ───────────────────────────────────────────
    search_cache_ttl_hours: int = 24

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

# Convenience flags
apify_configured = bool(config.apify_token)
scorer_configured = bool(config.scorer_api_key)
