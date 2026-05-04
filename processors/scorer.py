"""
관련도 스코어러 — DeepSeek으로 각 영상의 품질/관련도 평가
"""
from __future__ import annotations
import json
import logging
from typing import Optional

from core.config import config
from core.client import get_deepseek_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a medical spa video curator. Rate each video 0-10 for relevance to: "
    "medical aesthetics, cosmetic treatments, and med spa services. "
    "Score HIGH (7-10) for: actual treatment demos, before/after results, "
    "educational explanations of procedures (Botox, fillers, laser, skin treatments). "
    "Score MEDIUM (4-6) for: related beauty/skincare content, patient testimonials, "
    "provider marketing. "
    "Score LOW (1-3) for: unrelated content. "
    "Return JSON: {\"results\": [{\"url\": \"...\", \"score\": int, \"reason\": \"...\"}]}"
)


class Scorer:
    """검색 결과에 AI 관련도 점수 부여"""

    def __init__(self):
        self._deepseek = get_deepseek_client()

    def score(self, results: list[dict], query: str = "") -> list[dict]:
        """각 결과에 relevance_score 추가. AI 실패 시 기본값 5점"""
        if not self._deepseek or not results:
            for r in results:
                r["relevance_score"] = 5.0
                r["relevance_reason"] = ""
            return results

        batch_size = 25
        all_scored = []

        for i in range(0, len(results), batch_size):
            batch = results[i:i + batch_size]
            scored = self._score_batch(batch, query)
            all_scored.extend(scored)

        # 점수순 정렬
        all_scored.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        return all_scored

    def _score_batch(self, batch: list[dict], query: str) -> list[dict]:
        try:
            payload = {
                "task": "rate_videos",
                "query": query or "medical spa treatment before after",
                "videos": [
                    {"url": r["url"], "title": r.get("title", "")[:100]}
                    for r in batch
                ],
            }
            resp = self._deepseek.chat.completions.create(
                model=config.deepseek_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload)},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            data = json.loads(resp.choices[0].message.content)
            scores = data.get("results", data.get("videos", []))
        except Exception as e:
            logger.warning(f"Scoring batch failed: {e}")
            scores = []

        # 점수 맵
        score_map = {s["url"]: s for s in scores}

        for r in batch:
            s = score_map.get(r["url"], {})
            r["relevance_score"] = s.get("score", 5.0)
            r["relevance_reason"] = s.get("reason", "")

        return batch
