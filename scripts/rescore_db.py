"""
DB 정리: score 1-3은 바로 삭제, score=0만 재스코어링
"""
import json
import logging
from sqlalchemy import func

from storage.repository import Repository
from core.models import Video
from core.client import get_deepseek_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a medical spa video curator. Rate each video 0-10 by: "
    "shows actual treatment, before/after results, educational value, video quality. "
    "Return JSON: {\"results\": [{\"url\": \"...\", \"score\": int, \"reason\": \"...\"}]}"
)


def main():
    repo = Repository()
    client = get_deepseek_client()

    # === Step 1: score 1~3 바로 삭제 (이미 스코어링 완료된 저품질) ===
    to_delete = repo._session.query(Video).filter(
        Video.relevance_score >= 1,
        Video.relevance_score < 4,
    ).all()
    logger.info(f"🔴 바로 삭제 (score 1~3): {len(to_delete)}개")
    for v in to_delete:
        repo._session.delete(v)
    repo._session.commit()

    # === Step 2: score=0만 재스코어링 ===
    unscored = repo._session.query(Video).filter(Video.relevance_score == 0).all()
    logger.info(f"🔄 재스코어링 대상 (score=0): {len(unscored)}개")

    if not client or not unscored:
        logger.warning("DeepSeek 미설정 또는 대상 없음 — 미스코어링 스킵")
    else:
        BATCH_SIZE = 25
        updated = 0
        deleted = 0

        for i in range(0, len(unscored), BATCH_SIZE):
            batch = unscored[i:i + BATCH_SIZE]
            payload = {
                "task": "rate_videos",
                "query": "medical spa treatment before after facial botox filler",
                "videos": [
                    {"url": v.url, "title": (v.title or "")[:100]}
                    for v in batch
                ],
            }

            try:
                resp = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(payload)},
                    ],
                    temperature=0.2,
                )
                data = json.loads(resp.choices[0].message.content)
                scores = data.get("results", data.get("videos", []))
            except Exception as e:
                logger.warning(f"Batch {i // BATCH_SIZE} failed: {e}")
                scores = []

            score_map = {s["url"]: s for s in scores}

            for v in batch:
                s = score_map.get(v.url, {})
                new_score = s.get("score", 0)

                if new_score < 4:
                    repo._session.delete(v)
                    deleted += 1
                else:
                    v.relevance_score = new_score
                    updated += 1

            logger.info(f"  Batch {i // BATCH_SIZE + 1}: +{updated} updated, +{deleted} deleted")

        repo._session.commit()

    # 최종 통계
    total = repo._session.query(Video).count()
    no_thumb = repo._session.query(Video).filter(Video.thumbnail_url == '').count()

    print(f"\n=== 최종 통계 ===")
    print(f"전체 영상: {total}개")
    print(f"썸네일 없음: {no_thumb}개")

    by_platform = repo._session.query(
        Video.platform, func.count(Video.id)
    ).group_by(Video.platform).all()
    for p, c in by_platform:
        print(f"  {p}: {c}개")

    repo.close()


if __name__ == "__main__":
    main()
