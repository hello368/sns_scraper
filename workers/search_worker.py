"""
검색 워커 — Pipeline Stage 1: 플랫폼 검색 → 필터링 → DB 저장 (완전 동기)
"""
from __future__ import annotations
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.config import config
from core.client import get_apify_client, get_deepseek_client
from core.errors import ApifyError
from storage.repository import Repository
from processors.dedup import Deduplicator
from processors.scorer import Scorer
from workers.progress import should_stop, complete_progress as mark_progress

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
            dedup_hours: int = 24,
            # ─── 신규 파라미터 ──────────────
            max_days: Optional[int] = 30,
            min_likes: Optional[int] = None,
            min_comments: Optional[int] = None,
            min_views: Optional[int] = None,
            ) -> dict:
        """전체 검색 파이프라인 실행 (동기)

        Args:
            max_days: 검색 기간 제한 (일). 최근 N일 이내 영상만.
            min_likes/min_comments/min_views: 전역 engagement 오버라이드.
                None = 플랫폼 기본값 사용.
        """
        platforms = platforms or list(config.apify_actors.keys())
        max_per_keyword = max_per_keyword or config.max_results_per_keyword
        self._dedup_hours = dedup_hours
        self._target_region = region
        self._task_id = task_id
        # 신규 파라미터 저장
        self._max_days = max_days
        self._global_min_likes = min_likes
        self._global_min_comments = min_comments
        self._global_min_views = min_views

        # 1. 키워드 확장 (지역 반영)
        all_keywords = self._expand_keywords(keywords, region)
        logger.info(f"🔑 키워드 {len(keywords)}개 → {len(all_keywords)}개 확장됨 (region={region})")

        # 2. 플랫폼별 검색 (중단 가능)
        all_results = self._search_all_platforms(all_keywords, platforms, max_per_keyword)

        # 중단 체크
        if should_stop(task_id):
            logger.info("🛑 사용자 중단 요청 — 수집된 결과만 저장")
            self._save_results(all_results, region)
            return {
                "keywords_used": len(all_keywords),
                "total_raw": len(all_results),
                "after_dedup": len(all_results),
                "saved_to_db": len(all_results),
                "platforms": platforms,
                "region": region,
                "stopped": True,
            }

        # 3. 중복 제거
        deduper = Deduplicator(self._repo)
        filtered = deduper.dedup(all_results)
        logger.info(f"📊 중복 제거: {len(all_results)} → {len(filtered)}")

        # 중단 체크 (dedup 후에도)
        if should_stop(task_id):
            logger.info("🛑 사용자 중단 요청 — 중복 제거된 결과만 저장")
            self._save_results(filtered, region)
            return {
                "keywords_used": len(all_keywords),
                "total_raw": len(all_results),
                "after_dedup": len(filtered),
                "saved_to_db": len(filtered),
                "platforms": platforms,
                "region": region,
                "stopped": True,
            }

        # 4. AI 스코어링
        if filtered:
            scorer = Scorer()
            filtered = scorer.score(filtered)

        # 5. DB 저장 (region + engagement 포함)
        saved_count = self._save_results(filtered, region)

        logger.info(f"✅ 저장 완료: {saved_count}개 신규 영상 (region={region})")
        return {
            "keywords_used": len(all_keywords),
            "total_raw": len(all_results),
            "after_dedup": len(filtered),
            "saved_to_db": saved_count,
            "platforms": platforms,
            "region": region,
        }

    def _save_results(self, items: list[dict], region: str) -> int:
        """결과를 DB에 저장"""
        saved_count = 0
        for item in items:
            self._repo.save_video(
                url=item["url"],
                platform=item["platform"],
                title=item.get("title", ""),
                description=item.get("description", ""),
                thumbnail_url=item.get("thumbnail_url", ""),
                username=item.get("username", ""),
                region=region,
                likes=item.get("likes", 0) or 0,
                comments=item.get("comments", 0) or 0,
                views=item.get("views", 0) or 0,
                relevance_score=item.get("relevance_score", 5.0),
            )
            saved_count += 1
        return saved_count

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
        """모든 플랫폼 × 모든 키워드 검색 (동기, 순차, 중단 가능) + 진행 상황 업데이트"""
        if not self._apify:
            logger.error("Apify 미설정, 검색 불가")
            return []

        results = []
        total = len(keywords) * len(platforms)
        step = 0

        # 중단 체크용 콜백
        def _check_stop():
            if hasattr(self, '_task_id') and self._task_id and should_stop(self._task_id):
                logger.info(f"🛑 중단 감지됨 (step {step}/{total})")
                return True
            return False

        for keyword in keywords:
            for platform in platforms:
                step += 1

                # 🛑 중단 체크 (매 스텝마다)
                if _check_stop():
                    return results

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

    def _filter_by_date(self, parsed: dict) -> bool:
        """날짜 필터 — created_at이 max_days 이내인지 검사"""
        if not self._max_days:
            return True  # 제한 없음
        created_at = parsed.get("created_at", "")
        if not created_at:
            return True  # 날짜 정보 없으면 통과

        try:
            # 여러 날짜 형식 처리
            if isinstance(created_at, (int, float)):
                dt = datetime.fromtimestamp(int(created_at), tz=timezone.utc)
            elif "T" in created_at:
                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            elif " " in created_at:
                dt = datetime.strptime(created_at.split(".")[0], "%Y-%m-%d %H:%M:%S")
                dt = dt.replace(tzinfo=timezone.utc)
            else:
                dt = datetime.strptime(created_at[:10], "%Y-%m-%d")
                dt = dt.replace(tzinfo=timezone.utc)

            cutoff = datetime.now(timezone.utc) - timedelta(days=self._max_days)
            return dt >= cutoff
        except (ValueError, TypeError) as e:
            logger.debug(f"날짜 파싱 실패: {created_at} — {e}")
            return True  # 파싱 실패시 통과

    def _search_one(self, platform: str, keyword: str, limit: int) -> list[dict]:
        """단일 플랫폼 × 단일 키워드 검색 + engagement trending 필터 + engagement 최소조건"""
        try:
            collector = _get_collector(platform)
        except ValueError:
            logger.warning(f"지원 안 함: {platform}")
            return []

        # 피쳐링: 3배 많이 가져와서 engagement 기준 상위 N%만 유지
        fetch_limit = limit * collector.get_fetch_multiplier()
        run_input = collector.build_run_input(keyword, fetch_limit)
        actor_name = collector.apify_actor

        logger.info(f"🔍 {platform}/{keyword[:40]}... (fetch {fetch_limit}, keep {limit})")

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
                # ─── 새로운 필터들 ────────────────

                # 1️⃣ 기간 필터 (max_days)
                if not self._filter_by_date(parsed):
                    continue

                # 2️⃣ Engagement 최소 조건 (전역 오버라이드 → 플랫폼 기본값)
                min_likes = collector.min_likes()
                min_comments = collector.min_comments()
                min_views = collector.min_views()
                if self._global_min_likes is not None:
                    min_likes = self._global_min_likes
                if self._global_min_comments is not None:
                    min_comments = self._global_min_comments
                if self._global_min_views is not None:
                    min_views = self._global_min_views

                likes = int(parsed.get("likes", 0) or 0)
                comments = int(parsed.get("comments", 0) or 0)
                views = int(parsed.get("views", 0) or 0)

                if min_likes > 0 and likes < min_likes:
                    continue
                if min_comments > 0 and comments < min_comments:
                    continue
                if min_views > 0 and views < min_views:
                    continue

                results.append(parsed)
                if len(results) >= fetch_limit:
                    break

        # 🔥 Trending filter: engagement 기준 정렬 후 상위 N개만 유지
        results.sort(key=lambda r: collector.engagement_sort_key(r), reverse=True)
        results = results[:limit]

        self._repo.save_search(
            keyword=keyword, platform=platform,
            result_count=len(results),
            apify_run_id=run.get("id", ""),
        )

        logger.info(f"  → {len(results)}개 발견 ({platform}/{keyword[:30]})")
        return results
