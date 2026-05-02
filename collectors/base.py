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

    def extract_url(self, raw: dict) -> str:
        """원본 데이터에서 URL 추출 (플랫폼마다 필드명 다름)"""
        return raw.get("url") or raw.get("webLink") or ""


# 표준 응답 형식
STANDARD_FIELDS = [
    "platform", "url", "title", "description",
    "thumbnail_url", "username", "likes", "comments",
    "created_at",
]
