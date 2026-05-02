"""
검색 진행 상황 추적 — 스레드 안전, task_id 기반
"""
from __future__ import annotations
import threading
from typing import Optional


_search_progress: dict[str, dict] = {}
_lock = threading.Lock()


def create_progress(task_id: str, total_steps: int) -> dict:
    """진행 상황 초기화"""
    with _lock:
        p = {
            "task_id": task_id,
            "status": "running",  # running / completed / failed
            "total_steps": total_steps,
            "completed_steps": 0,
            "current_platform": "",
            "current_keyword": "",
            "results_so_far": 0,
            "error": None,
            "elapsed_sec": 0,
        }
        _search_progress[task_id] = p
        return p


def update_progress(task_id: str, **kwargs):
    """진행 상황 업데이트"""
    with _lock:
        p = _search_progress.get(task_id)
        if p:
            p.update(kwargs)


def get_progress(task_id: str) -> Optional[dict]:
    """진행 상황 조회"""
    with _lock:
        p = _search_progress.get(task_id)
        return p.copy() if p else None


def complete_progress(task_id: str, error: Optional[str] = None):
    """완료 처리"""
    with _lock:
        p = _search_progress.get(task_id)
        if p:
            p["status"] = "failed" if error else "completed"
            p["error"] = error


def cleanup_progress(task_id: str):
    """오래된 진행 상황 정리"""
    with _lock:
        _search_progress.pop(task_id, None)
