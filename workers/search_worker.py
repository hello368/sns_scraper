"""
검색 워커 — Pipeline Stage 1: 플랫폼 검색 → 필터링 → DB 저장 (완전 동기)
"""
from __future__ import annotations
import json
import logging
import time
from typing import Optional

from core.config import config
from core.client import get_apify_client, get_deepseek_client
from core.errors import ApifyError
from storage.repository import Repository
from processors.dedup import Deduplicator
from processors.scorer import Scorer

logger = logging.getLogger(__name__)


_COLLECTOR_MAP: dict = {}

def _get_collector(platform: str):
    if platform not in _COLLECTOR_MAP:
        if platform == "instagram":
            from collectors.instagram import InstagramCollector
            _COLLECTOR_MAP[platform] = InstagramCollector()
        elif platform == "tiktok":
            from collectors.tiktok import TikTokCollector
            _COLLECTOR_MAP[platform] = TikTokCollector()
        elif platform == "facebook":
            from collectors.facebook import FacebookCollector
            _COLLECTOR_MAP[platform] = FacebookCollector()
        elif platform == "youtube":
            from collectors.youtube import YouTubeCollector
            _COLLECTOR_MAP[platform] = YouTubeCollector()
        else:
            raise ValueError(f"Unknown platform: {platform}")
    return _COLLECTOR_MAP[platform]


class SearchWorker:
    """검색 파이프라인 (완전 동기, asyncio 없음)"""

    def __init__(self, repo: Optional[Repository] = None):
        self._repo = repo or Repository()
        self._apify = get_apify_client()

    def run(self, keywords: list[str],
            platforms: list[str] | None = None,
            max_per_keyword: int | None = None) -> dict:
        """전체 검색 파이프라인 실행 (동기)"""
        platforms = platforms or list(config.apify_actors.keys())
        max_per_keyword = max_per_keyword or config.max_results_per_keyword

        # 1. 키워드 확장
        all_keywords = self._expand_keywords(keywords)
        logger.info(f"🔑 키워드 {len(keywords)}개 → {len(all_keywords)}개 확장됨")

        # 2. 플랫폼별 검색
        all_results = self._search_all_platforms(all_keywords, platforms, max_per_keyword)

        # 3. 중복 제거
        deduper = Deduplicator(self._repo)
        filtered = deduper.dedup(all_results)
        logger.info(f"📊 중복 제거: {len(all_results)} → {len(filtered)}")

        # 4. AI 스코어링
        if filtered:
            scorer = Scorer()
            filtered = scorer.score(filtered)

        # 5. DB 저장
        saved_count = 0
        for item in filtered:
            self._repo.save_video(
                url=item["url"],
                platform=item["platform"],
                title=item.get("title", ""),
                description=item.get("description", ""),
                thumbnail_url=item.get("thumbnail_url", ""),
                username=item.get("username", ""),
                relevance_score=item.get("relevance_score", 5.0),
            )
            saved_count += 1

        logger.info(f"✅ 저장 완료: {saved_count}개 신규 영상")
        return {
            "keywords_used": len(all_keywords),
            "total_raw": len(all_results),
            "after_dedup": len(filtered),
            "saved_to_db": saved_count,
            "platforms": platforms,
        }

    def _expand_keywords(self, seeds: list[str]) -> list[str]:
        """DeepSeek으로 키워드 확장"""
        client = get_deepseek_client()
        if not client:
            return seeds

        try:
            resp = client.chat.completions.create(
                model=config.deepseek_model,
                messages=[{
                    "role": "system",
                    "content": "Generate 10 search queries. Return JSON: {\"queries\": [...]}",
                }, {
                    "role": "user",
                    "content": json.dumps({
                        "task": "expand_keywords",
                        "seeds": seeds,
                        "context": "Medical spa, facial, botox, filler treatment videos",
                    }),
                }],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            data = json.loads(resp.choices[0].message.content)
            expanded = data.get("queries", data.get("keywords", []))
            return list(dict.fromkeys(seeds + expanded))
        except Exception as e:
            logger.warning(f"키워드 확장 실패: {e}")
            return seeds

    def _search_all_platforms(
        self, keywords: list[str], platforms: list[str], limit: int
    ) -> list[dict]:
        """모든 플랫폼 × 모든 키워드 검색 (동기, 순차)"""
        if not self._apify:
            logger.error("Apify 미설정, 검색 불가")
            return []

        results = []
        for keyword in keywords:
            for platform in platforms:
                if self._repo.already_searched(keyword, platform):
                    logger.info(f"  ⏭️ 이미 검색됨: {platform}/{keyword[:30]}")
                    continue
                try:
                    items = self._search_one(platform, keyword, limit)
                    results.extend(items)
                    time.sleep(1)  # rate limit
                except Exception as e:
                    logger.error(f"검색 실패 {platform}/{keyword[:30]}: {e}")

        return results

    def _search_one(self, platform: str, keyword: str, limit: int) -> list[dict]:
        """단일 플랫폼 × 단일 키워드 검색"""
        try:
            collector = _get_collector(platform)
        except ValueError:
            logger.warning(f"지원 안 함: {platform}")
            return []

        run_input = collector.build_run_input(keyword, limit)
        actor_name = collector.apify_actor

        logger.info(f"🔍 {platform}/{keyword[:40]}...")

        try:
            run = self._apify.actor(actor_name).call(run_input=run_input)
        except Exception as e:
            logger.error(f"Apify 실행 실패 {platform}/{keyword}: {e}")
            self._repo.save_search(keyword, platform, status="failed", error=str(e))
            return []

        results = []
        for item in self._apify.dataset(run["defaultDatasetId"]).iterate_items():
            parsed = collector.parse_item(item)
            if parsed and collector.validate(parsed):
                results.append(parsed)
                if len(results) >= limit:
                    break

        self._repo.save_search(
            keyword=keyword, platform=platform,
            result_count=len(results),
            apify_run_id=run.get("id", ""),
        )

        logger.info(f"  → {len(results)}개 발견 ({platform}/{keyword[:30]})")
        return results
