"""
분류기 — 키워드 매칭 + AI 분류 (fallback 구조)
"""
from __future__ import annotations
import json
import logging
from typing import Optional

from core.config import config
from core.client import get_deepseek_client

logger = logging.getLogger(__name__)

# AI 실패 시 사용할 fallback 키워드 맵
CATEGORY_KEYWORDS = config.categories


class Classifier:
    """영상 제목/설명을 기반으로 카테고리 분류"""

    def __init__(self):
        self._deepseek = get_deepseek_client()

    def classify(self, title: str, description: str = "") -> dict:
        """AI 우선 분류, 실패 시 키워드 매칭 fallback"""
        result = self._ai_classify(title, description)
        if result and result.get("category") != "other":
            return result
        # AI가 실패하거나 uncertain → fallback
        fallback = self._keyword_classify(title, description)
        return {
            "category": fallback,
            "confidence": 0.5,
            "method": "keyword",
        }

    def _ai_classify(self, title: str, description: str) -> Optional[dict]:
        if not self._deepseek:
            return None
        prompt = {
            "task": "classify_treatment_video",
            "title": title[:200],
            "description": description[:300] if description else "",
            "categories": list(CATEGORY_KEYWORDS.keys()),
        }
        try:
            resp = self._deepseek.chat.completions.create(
                model=config.scorer_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You classify medical spa treatment videos. "
                            "Return ONLY valid JSON, no markdown, no code fences. "
                            "Format: {\"category\": str, \"confidence\": 0-1, "
                            "\"treatment\": str}. Categories: facial, botox, filler, medical-spa, other."
                        ),
                    },
                    {"role": "user", "content": json.dumps(prompt)},
                ],
                temperature=0.3,  # 낮은 온도 = 일관된 출력
            )
            data = json.loads(resp.choices[0].message.content)
            if data.get("category") in CATEGORY_KEYWORDS:
                data["method"] = "ai"
                return data
            return None
        except Exception as e:
            logger.warning(f"AI 분류 실패 (fallback): {e}")
            return None

    def _keyword_classify(self, title: str, description: str) -> str:
        text = f"{title} {description}".lower()
        for category, keywords in CATEGORY_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                return category
        return "other"
