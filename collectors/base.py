"""
플랫폼 컬렉터 추상 클래스 — 모든 플랫폼이 이 인터페이스를 구현
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional


class PlatformCollector(ABC):
    """각 소셜미디어 플랫폼의 검색 전략"""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def apify_actor(self) -> str: ...

    @abstractmethod
    def build_run_input(self, keyword: str, limit: int) -> dict:
        """Apify Actor 실행에 필요한 입력 파라미터 생성"""

    @abstractmethod
    def parse_item(self, raw: dict) -> Optional[dict]:
        """Apify 응답의 한 아이템을 표준 형식으로 변환"""

    def validate(self, parsed: dict) -> bool:
        """결과 유효성 검사 (오버라이드 가능)"""
        return bool(parsed.get("url"))

    def engagement_sort_key(self, parsed: dict) -> float:
        """Engagement score for trending filter — 높을수록 인기 영상"""
        likes = int(parsed.get("likes", 0) or 0)
        comments = int(parsed.get("comments", 0) or 0)
        views = int(parsed.get("views", 0) or 0)
        # 가중치: 좋아요 1x, 댓글 3x, 조회수 0.01x
        return likes + comments * 3 + views * 0.01

    def get_fetch_multiplier(self) -> int:
        """Apify에서 몇 배로 많이 가져올지 (trending top-N 필터용)"""
        return 3

    def extract_url(self, raw: dict) -> str:
        """원본 데이터에서 URL 추출 (플랫폼마다 필드명 다름)"""
        return raw.get("url") or raw.get("webLink") or ""

    # ─── Engagement thresholds ───────────────────────────
    def min_likes(self) -> int:
        """이 플랫폼에서 통과할 최소 좋아요 수 (0 = 비활성화)"""
        return 0

    def min_comments(self) -> int:
        """최소 댓글 수 (0 = 비활성화)"""
        return 0

    def min_views(self) -> int:
        """최소 조회수 (0 = 비활성화)"""
        return 0

    def meets_engagement_threshold(self, parsed: dict) -> bool:
        """Engagement 최소 조건을 만족하는지 검사"""
        likes = int(parsed.get("likes", 0) or 0)
        comments = int(parsed.get("comments", 0) or 0)
        views = int(parsed.get("views", 0) or 0)
        min_l = self.min_likes()
        min_c = self.min_comments()
        min_v = self.min_views()
        if min_l > 0 and likes < min_l:
            return False
        if min_c > 0 and comments < min_c:
            return False
        if min_v > 0 and views < min_v:
            return False
        return True


# 표준 응답 형식
STANDARD_FIELDS = [
    "platform", "url", "title", "description",
    "thumbnail_url", "username", "likes", "comments",
    "created_at",
]
