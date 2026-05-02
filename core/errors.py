"""
계층형 에러 시스템
각 실패 상황을 구체적인 예외로 표현 → API에서 적절한 HTTP 코드로 변환
"""
from __future__ import annotations


class MediSpaError(Exception):
    """모든 커스텀 에러의 베이스"""

    def __init__(self, message: str, *, detail: str | None = None, recoverable: bool = False):
        self.detail = detail
        self.recoverable = recoverable
        super().__init__(message)


# ─── Apify ────────────────────────────────────────────────

class ApifyError(MediSpaError):
    """Apify 관련 에러 베이스"""

class ApifyAuthError(ApifyError):
    """API 토큰 만료/무효 → HTTP 401"""

class ApifyRateLimitError(ApifyError):
    """Rate limit 도달 → 백오프 후 재시도 가능"""

class ApifyQuotaError(ApifyError):
    """Starter 플랜 크레딧 소진 → HTTP 402"""

class ApifyRunError(ApifyError):
    """Actor 실행 자체 실패 (타임아웃, 내부 에러)"""


# ─── DeepSeek ─────────────────────────────────────────────

class DeepSeekError(MediSpaError):
    """DeepSeek API 호출 실패"""

class DeepSeekTimeoutError(DeepSeekError):
    """30초 제한 초과"""

class DeepSeekParseError(DeepSeekError):
    """JSON 응답 파싱 실패"""


# ─── Storage ──────────────────────────────────────────────

class StorageError(MediSpaError):
    """파일 저장 관련"""

class DiskFullError(StorageError):
    """디스크 90% 이상"""

class DownloadError(MediSpaError):
    """yt-dlp 다운로드 실패"""

class VideoValidationError(MediSpaError):
    """영상 유효성 검사 실패 (0바이트, 너무 짧음, 깨짐)"""


# ─── Pipeline ─────────────────────────────────────────────

class PipelineError(MediSpaError):
    """파이프라인 실행 중 오류"""

class StageNotFoundError(PipelineError):
    """존재하지 않는 Stage 조회"""


# ─── Mapping for API responses ────────────────────────────

ERROR_TO_STATUS = {
    ApifyAuthError: 401,
    ApifyQuotaError: 402,
    ApifyRateLimitError: 429,
    PipelineError: 500,
    StorageError: 507,  # Insufficient Storage
    DiskFullError: 507,
}
