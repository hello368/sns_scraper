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

import re

logger = logging.getLogger(__name__)

_COLLECTOR_MAP: dict = {}

def _get_collector(platform: str):
    if platform not in _COLLECTOR_MAP:
        if platform == "tiktok":
            from collectors.tiktok import TikTokCollector
            _COLLECTOR_MAP[platform] = TikTokCollector()
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
            expand_keywords: bool = True,
            ) -> dict:
        """전체 검색 파이프라인 실행 (동기)

        Args:
            max_days: 검색 기간 제한 (일). 최근 N일 이내 영상만.
            min_likes/min_comments/min_views: 전역 engagement 오버라이드.
                None = 플랫폼 기본값 사용.
            expand_keywords: False면 DeepSeek 키워드 확장 스킵 (개별 탭 검색용)
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

        # 1. 키워드 확장 (지역 반영) — 개별 탭 검색은 확장 스킵
        if expand_keywords:
            all_keywords = self._expand_keywords(keywords, region)
            logger.info(f"🔑 키워드 {len(keywords)}개 → {len(all_keywords)}개 확장됨 (region={region})")
        else:
            all_keywords = list(keywords)
            logger.info(f"🔑 키워드 확장 스킵: 원본 {len(keywords)}개 사용")

        # 2. 플랫폼별 검색 (중단 가능)
        all_results = self._search_all_platforms(all_keywords, platforms, max_per_keyword, original_keywords=keywords)

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

        # 4.5 관련도 필터 — 점수 3 미만은 저장하지 않음
        # Med Spa 콘텐츠는 제목만으로 정확한 평가가 어려워 낮은 기준 적용
        MIN_RELEVANCE = 3
        before_filter = len(filtered)
        filtered = [r for r in filtered if r.get("relevance_score", 0) >= MIN_RELEVANCE]
        removed = before_filter - len(filtered)
        if removed:
            logger.info(f"🔍 관련도 필터: {removed}개 제외 (score < {MIN_RELEVANCE}), {len(filtered)}개 유지")

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
        """결과를 DB에 저장 — 중복은 카운트 제외"""
        saved_count = 0
        for item in items:
            url = item["url"]
            # 중복이면 건너뛰고 카운트도 하지 않음
            if self._repo.video_exists(url):
                continue
            self._repo.save_video(
                url=url,
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
                model=config.scorer_model,
                messages=[{
                    "role": "system",
                    "content": (
                        "Generate 10 search queries in ENGLISH only. "
                        "The queries target content relevant to the specified region, "
                        "but all query terms must be in English. "
                        "Return ONLY valid JSON, no markdown, no code fences. "
                        "Format: {\"queries\": [...]}"
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
                            f"relevant to {region_names}. Use English terms only."
                        ),
                    }),
                }],
                temperature=0.3,
            )
            data = json.loads(resp.choices[0].message.content)
            expanded = data.get("queries", data.get("keywords", []))
            return list(dict.fromkeys(seeds + expanded))
        except Exception as e:
            logger.warning(f"키워드 확장 실패: {e}")
            return seeds

    def _search_all_platforms(
        self, keywords: list[str], platforms: list[str], limit: int,
        original_keywords: list[str] | None = None
    ) -> list[dict]:
        """모든 플랫폼 × 모든 키워드 검색 (동기, 순차, 중단 가능) + 진행 상황 업데이트"""
        if not self._apify:
            logger.error("Apify 미설정, 검색 불가")
            return []

        results = []
        # HASHTAG 전략 플랫폼은 원본 키워드만 사용 (확장X → 해시태그 변환시 무의미)
        from collectors.platform_defaults import get_config as _get_cfg
        platform_configs = {p: _get_cfg(p) for p in platforms}
        original_set = set(original_keywords or [])
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

                # 🛑 HASHTAG 전략: 확장 키워드 스킵 (해시태그가 아닌 키워드는 0건)
                cfg = platform_configs.get(platform)
                if cfg and cfg.search_strategy.name == "HASHTAG":
                    if keyword not in original_set and len(original_set) > 0:
                        logger.debug(f"  ⏭️ HASHTAG 스킵 (확장): {platform}/{keyword[:30]}")
                        continue

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
        """단일 플랫폼 × 단일 키워드 검색 + engagement 필터"""
        import re  # 🛡️ 로컬 임포트 (모듈 레벨이 안 먹는 케이스 대응)
        try:
            collector = _get_collector(platform)
        except ValueError:
            logger.warning(f"지원 안 함: {platform}")
            return []

        # 날짜 필터 문자열 생성 (액터가 지원하는 형식으로)
        date_filter = None
        if self._max_days:
            from collectors.platform_defaults import get_config
            cfg = get_config(platform)
            if cfg.has_date_filter:
                if cfg.date_supports_relative:
                    date_filter = f"{self._max_days} days"
                else:
                    # enum 방식: hour/today/week/month/year
                    if self._max_days <= 1:
                        date_filter = "today"
                    elif self._max_days <= 7:
                        date_filter = "week"
                    elif self._max_days <= 30:
                        date_filter = "month"
                    else:
                        date_filter = "year"

        # 일반 전략
        run_input = collector.build_run_input(keyword, limit, date_filter=date_filter)
        return self._execute_search(platform, keyword, limit, collector, run_input)

    def _execute_search(self, platform: str, keyword: str, limit: int,
                        collector, run_input: dict) -> list[dict]:
        """실제 Apify 호출 + 파싱 + 필터링 (중단 가능)"""
        actor_name = collector.apify_actor
        logger.info(f"🔍 {platform}/{keyword[:40]}... (limit {limit})")

        # inline stop check
        from workers.progress import should_stop
        def _is_stopped():
            return hasattr(self, '_task_id') and self._task_id and should_stop(self._task_id)

        # 1️⃣ 중단 체크 (Apify 호출 전)
        if _is_stopped():
            logger.info(f"  ⏹️ 중단됨 (호출 전): {platform}/{keyword[:30]}")
            return []

        try:
            # 비동기 start → poll 방식으로 변경 (blocking call 회피)
            run = self._apify.actor(actor_name).start(run_input=run_input)
            run_id = run["id"]
            logger.info(f"  ⏳ {actor_name} 실행 시작: {run_id}")
        except Exception as e:
            logger.error(f"Apify 실행 실패 {platform}/{keyword}: {e}")
            self._repo.save_search(keyword, platform, status="failed", error=str(e))
            return []

        # 2️⃣ Poll while waiting, check stop
        import time as _time
        max_wait = 120  # 2분 타임아웃
        waited = 0
        while waited < max_wait:
            # 중단 체크
            if _is_stopped():
                logger.info(f"  ⏹️ 중단 감지 — Apify run abort: {run_id}")
                try:
                    self._apify.run(run_id).abort()
                except Exception:
                    logger.debug(f"  ⚠️ Apify run abort 실패 (무시): {run_id}")
                    pass
                return []

            # Run 상태 확인
            try:
                run_info = self._apify.run(run_id).get()
                status = run_info.get("status", "UNKNOWN")
                if status == "SUCCEEDED":
                    break
                elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
                    logger.warning(f"  ⚠️ Apify run {status}: {run_id}")
                    self._repo.save_search(keyword, platform, status=status.lower())
                    return []
            except Exception:
                logger.debug("  ⚠️ Apify 상태 폴링 실패 (재시도)")
                pass

            _time.sleep(2)
            waited += 2

        if waited >= max_wait:
            logger.warning(f"  ⏰ Apify 타임아웃: {run_id}")
            self._apify.run(run_id).abort()
            return []

        # ✅ fetch defaultDatasetId from run info (start() may not include it)
        try:
            run_info = self._apify.run(run_id).get()
            dataset_id = run_info["defaultDatasetId"]
        except Exception as e:
            logger.error(f"  ❌ 데이터셋 ID 조회 실패: {e}")
            return []

        results = []
        # 🚀 성능/안정성: 동일 플랫폼의 기존 영상 ID를 미리 로드 (SQLAlchemy 세션 우회)
        from storage.repository import video_id_from_url
        from sqlalchemy import text as _sql_text
        try:
            existing_ids = set(
                row[0] for row in
                self._repo._session.execute(
                    _sql_text("SELECT id FROM videos WHERE platform = :p"),
                    {"p": platform}
                ).fetchall()
            )
        except Exception:
            existing_ids = set()
            logger.warning(f"  ⚠️ 기존 ID 로드 실패, 중복 체크 스킵: {platform}")
        if existing_ids:
            logger.info(f"  📦 기존 {platform} 영상 {len(existing_ids)}개 로드 — 중복 체크용")

        # 페이지네이션 방식으로 데이터셋 아이템 로드 (iterate_items 대신)
        offset = 0
        page_size = 50
        while True:
            page = self._apify.dataset(dataset_id).list_items(offset=offset, limit=page_size).items
            if not page:
                break
            for item in page:
                parsed = collector.parse_item(item)
                if parsed and collector.validate(parsed):

                    # 1️⃣ 기간 필터 (max_days)
                    if not self._filter_by_date(parsed):
                        continue

                    # 2️⃣ Engagement 최소 조건
                    min_likes = collector.min_likes()
                    min_comments = collector.min_comments()
                    min_views = collector.min_views()
                    if self._global_min_likes is not None:
                        min_likes = max(min_likes, self._global_min_likes)
                    if self._global_min_comments is not None:
                        min_comments = max(min_comments, self._global_min_comments)
                    if self._global_min_views is not None:
                        min_views = max(min_views, self._global_min_views)

                    likes = int(parsed.get("likes", 0) or 0)
                    comments = int(parsed.get("comments", 0) or 0)
                    views = int(parsed.get("views", 0) or 0)

                    if min_likes > 0 and likes < min_likes:
                        continue
                    if min_comments > 0 and comments < min_comments:
                        continue
                    if min_views > 0 and views < min_views:
                        continue

                    # 3️⃣ 이미 DB에 있는 URL인가? — Apify 크레딧 낭비 방지
                    url = parsed.get("url", "")
                    if url and video_id_from_url(url) in existing_ids:
                        continue

                    results.append(parsed)
                    if len(results) >= limit:
                        break

                if len(results) >= limit:
                    break

            # 다음 페이지로 이동
            if len(results) >= limit:
                break
            offset += page_size

        # Engagement 정렬 후 상위 N개
        results.sort(key=lambda r: collector.engagement_sort_key(r), reverse=True)
        results = results[:limit]

        usage = run.get("usage", {}) or {}
        cu_cost = usage.get("ACTOR_COMPUTE_UNITS", usage.get("usageTotalUsd", 0.0)) or 0.0

        self._repo.save_search(
            keyword=keyword, platform=platform,
            result_count=len(results),
            apify_run_id=run.get("id", ""),
            cu_cost=cu_cost,
        )

        logger.info(f"  → {len(results)}개 발견 ({platform}/{keyword[:30]})")
        return results
