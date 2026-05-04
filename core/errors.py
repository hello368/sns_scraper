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
    """Apify API 에러 베이스"""

class ApifyAuthError(ApifyError):
    """Apify 인증 실패 (401)"""

class ApifyQuotaError(ApifyError):
    """Apify 할당량 초과 (402)"""


# ─── DeepSeek ─────────────────────────────────────────────

class DeepSeekError(MediSpaError):
    """DeepSeek API 호출 실패"""


# ─── Storage ──────────────────────────────────────────────

class StorageError(MediSpaError):
    """파일 저장 관련"""

class DiskFullError(StorageError):
    """디스크 90% 이상"""

class DownloadError(MediSpaError):
    """yt-dlp 다운로드 실패"""

class VideoValidationError(MediSpaError):
    """영상 유효성 검사 실패 (0바이트, 너무 짧음, 깨짐)"""


# ─── Mapping for API responses ────────────────────────────

ERROR_TO_STATUS = {
    ApifyError: 500,
    StorageError: 507,  # Insufficient Storage
    DiskFullError: 507,
}
