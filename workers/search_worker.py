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

    REGION_NAMES = {
        "US": "United States, USA, America",
        "JP": "Japan, 日本",
        "KR": "South Korea, 한국",
        "EU": "Europe, EU, France, Germany, Italy, Spain, UK",
    }

    def __init__(self, repo: Optional[Repository] = None):
        self._repo = repo or Repository()
        self._apify = get_apify_client()

    def run(self, keywords: list[str],
            platforms: list[str] | None = None,
            max_per_keyword: int | None = None,
            region: str = "US",
            task_id: str = "",
            dedup_hours: int = 24) -> dict:
        """전체 검색 파이프라인 실행 (동기)

        Args:
            dedup_hours: 이미 검색된 키워드 재검색 방지 윈도우 (시간).
                         6=6시간 내 검색된 것만 스킵, 0=항상 새로 검색.
        """
        platforms = platforms or list(config.apify_actors.keys())
        max_per_keyword = max_per_keyword or config.max_results_per_keyword
        self._dedup_hours = dedup_hours
        self._target_region = region
        self._task_id = task_id  # 진행 상황 추적용

        # 1. 키워드 확장 (지역 반영)
        all_keywords = self._expand_keywords(keywords, region)
        logger.info(f"🔑 키워드 {len(keywords)}개 → {len(all_keywords)}개 확장됨 (region={region})")

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

        # 5. DB 저장 (region 포함)
        saved_count = 0
        for item in filtered:
            self._repo.save_video(
                url=item["url"],
                platform=item["platform"],
                title=item.get("title", ""),
                description=item.get("description", ""),
                thumbnail_url=item.get("thumbnail_url", ""),
                username=item.get("username", ""),
                region=region,
                relevance_score=item.get("relevance_score", 5.0),
            )
            saved_count += 1

        logger.info(f"✅ 저장 완료: {saved_count}개 신규 영상 (region={region})")
        return {
            "keywords_used": len(all_keywords),
            "total_raw": len(all_results),
            "after_dedup": len(filtered),
            "saved_to_db": saved_count,
            "platforms": platforms,
            "region": region,
        }

    def _expand_keywords(self, seeds: list[str], region: str = "US") -> list[str]:
        """DeepSeek으로 키워드 확장 — 지역 반영"""
        client = get_deepseek_client()
        if not client:
            return seeds

        region_names = self.REGION_NAMES.get(region, "Global")
        try:
            resp = client.chat.completions.create(
                model=config.deepseek_model,
                messages=[{
                    "role": "system",
                    "content": (
                        "Generate 10 search queries tailored for the specified region. "
                        "Return JSON: {\"queries\": [...]}"
                    ),
                }, {
                    "role": "user",
                    "content": json.dumps({
                        "task": "expand_keywords",
                        "seeds": seeds,
                        "region": region,
                        "region_names": region_names,
                        "context": (
                            f"Medical spa, facial, botox, filler treatment videos "
                            f"relevant to {region_names}. Use localized terms."
                        ),
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
        """모든 플랫폼 × 모든 키워드 검색 (동기, 순차) + 진행 상황 업데이트"""
        if not self._apify:
            logger.error("Apify 미설정, 검색 불가")
            return []

        results = []
        total = len(keywords) * len(platforms)
        step = 0
        for keyword in keywords:
            for platform in platforms:
                step += 1
                # 진행 상황 업데이트
                if hasattr(self, '_task_id') and self._task_id:
                    from workers.progress import update_progress
                    update_progress(
                        self._task_id,
                        current_platform=platform,
                        current_keyword=keyword[:40],
                        completed_steps=step,
                        results_so_far=len(results),
                    )

                if self._repo.already_searched(keyword, platform, self._dedup_hours):
                    logger.info(f"  ⏭️ 이미 검색됨: {platform}/{keyword[:30]}")
                    continue
                try:
                    items = self._search_one(platform, keyword, limit)
                    results.extend(items)
                    # 결과 업데이트
                    if hasattr(self, '_task_id') and self._task_id:
                        from workers.progress import update_progress
                        update_progress(self._task_id, results_so_far=len(results))
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
