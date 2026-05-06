#!/usr/bin/env python3
"""Botox 전용 수집 스크립트 — botox 키워드로 30개 수집"""
import sys, json, logging
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)
logger = logging.getLogger("botox_collect")

def main():
    from workers.search_worker import SearchWorker
    from storage.repository import Repository
    
    repo = Repository()
    worker = SearchWorker(repo=repo)
    
    # DB 테이블 확인
    from sqlalchemy import inspect
    inspector = inspect(repo._session.bind)
    tables = inspector.get_table_names()
    logger.info(f"DB tables: {tables}")
    
    keywords = ["botox"]
    platforms = ["tiktok", "youtube"]
    
    result = worker.run(
        keywords=keywords,
        platforms=platforms,
        max_per_keyword=30,  # 30개씩
        dedup_hours=0,        # 같은 세션 중복 방지 X
        expand_keywords=False, # 키워드 확장 없이 botox만
        max_days=365,         # 1년 이내
    )
    
    # 결과에서 DB 조회
    stats = repo.get_library_stats()
    result["total_videos_now"] = stats.get("total_videos", 0)
    result["by_platform"] = stats.get("by_platform", {})
    result["by_category"] = stats.get("by_category", {})
    
    # 저장된 영상 목록 조회
    all_videos = repo.get_all_videos(limit=100)
    
    print(json.dumps({
        "result": result,
        "videos": [
            {
                "id": v.id,
                "platform": v.platform,
                "title": v.title[:80] if v.title else "",
                "url": v.url,
                "views": v.views,
                "likes": v.likes,
                "relevance_score": v.relevance_score,
                "created_at": str(v.created_at)[:19] if v.created_at else "",
            }
            for v in all_videos
            if "botox" in (v.title or "").lower() or "tox" in (v.title or "").lower() or v.category == "botox"
        ]
    }, ensure_ascii=False, indent=2))
    
    repo.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
