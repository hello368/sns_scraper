#!/usr/bin/env python3
"""
MediSpa AI — Batch Collection Script
서버 없이 SearchWorker를 직접 실행하여 영상 수집.
stdout으로 JSON 결과 출력 (cronjob이 파싱 가능).
"""

import sys
import json
import logging
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

# 로깅 설정 (stderr로만 출력, stdout은 JSON만)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("medispa.collect")


def main():
    from workers.search_worker import SearchWorker
    from storage.repository import Repository
    from core.config import config

    # ── 수집할 키워드 (config의 카테고리에서 추출) ──
    all_keywords = []
    for cat, kws in config.categories.items():
        all_keywords.extend(kws)
    # 중복 제거
    all_keywords = list(dict.fromkeys(all_keywords))

    platforms = ["tiktok", "instagram", "youtube"]

    logger.info(f"🚀 MediSpa AI Batch Collection 시작")
    logger.info(f"   키워드: {len(all_keywords)}개")
    logger.info(f"   플랫폼: {platforms}")

    start_time = __import__("time").time()

    repo = Repository()
    try:
        worker = SearchWorker(repo=repo)
        result = worker.run(
            keywords=all_keywords,
            platforms=platforms,
            dedup_hours=7,  # 4x daily → 6h window; 7h ensures overlap safety
        )

        # 완료 후 DB 통계 조회
        stats = repo.get_library_stats()

        elapsed = __import__("time").time() - start_time
        result["elapsed_sec"] = round(elapsed, 1)
        result["total_videos_now"] = stats["total_videos"]
        result["by_category"] = stats["by_category"]
        result["by_platform"] = stats["by_platform"]

        logger.info(f"✅ Batch 완료 ({elapsed:.1f}초)")
        logger.info(
            f"   Found: {result['total_raw']} → Saved: {result['saved_to_db']} "
            f"(총 {stats['total_videos']}개)"
        )

        # stdout에 JSON 출력 (cronjob이 캡처)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as e:
        logger.exception(f"❌ Batch 실패: {e}")
        print(json.dumps({"error": str(e), "status": "failed"}))
        return 1
    finally:
        repo.close()


if __name__ == "__main__":
    sys.exit(main())
