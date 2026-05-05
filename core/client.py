"""
외부 API 클라이언트 관리 — Apify + OpenRouter/DeepSeek
"""
from __future__ import annotations
import logging

from apify_client import ApifyClient
from openai import OpenAI

from core.config import config
from core.errors import ApifyError

logger = logging.getLogger(__name__)


def get_apify_client() -> ApifyClient | None:
    """ApifyClient 인스턴스 반환. 토큰 없으면 None"""
    if not config.apify_token:
        logger.warning("Apify 토큰이 설정되지 않음")
        return None
    return ApifyClient(config.apify_token)


def get_deepseek_client() -> OpenAI | None:
    """LLM OpenAI 호환 클라이언트 반환 (영상 스코어링용)
    우선순위: OpenRouter > DeepSeek (둘 다 OpenAI 호환)
    """
    if not config.scorer_api_key:
        provider = "OpenRouter" if config.using_openrouter else "DeepSeek"
        logger.warning(f"{provider} API 키가 설정되지 않음")
        return None
    return OpenAI(
        api_key=config.scorer_api_key,
        base_url=config.scorer_base_url,
    )


def validate_apify_token(client: ApifyClient | None) -> bool:
    """Apify 토큰 유효성 검사"""
    if not client:
        return False
    try:
        client.user("me").get()
        return True
    except Exception as e:
        logger.error(f"Apify 토큰 검증 실패: {e}")
        raise ApifyError("Apify 토큰이 유효하지 않습니다", detail=str(e))
