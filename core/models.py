"""
DB 모델 — SQLAlchemy + SQLite
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, create_engine, Index, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import config

Base = declarative_base()


def _utcnow():
    return datetime.now(timezone.utc)

def _new_id() -> str:
    return uuid.uuid4().hex[:12]


class User(Base):
    """사용자 계정 — 로그인 + 권한 관리"""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_new_id)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(200), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), default="user")          # admin / user
    is_active = Column(Integer, default=1)
    created_by = Column(String(80), default="system")
    created_at = Column(DateTime, default=_utcnow)
    last_login = Column(DateTime)


class SearchRecord(Base):
    """검색 이력 — 중복 검색 방지 + 비용 추적"""
    __tablename__ = "searches"

    id = Column(String, primary_key=True, default=_new_id)
    keyword = Column(String(200), nullable=False, index=True)
    platform = Column(String(20), nullable=False)
    result_count = Column(Integer, default=0)
    apify_run_id = Column(String(100))
    cu_cost = Column(Float, default=0.0)
    status = Column(String(20), default="completed")  # running / completed / failed
    error = Column(Text)
    created_at = Column(DateTime, default=_utcnow)

    __table_args__ = (
        Index("idx_search_keyword_platform_date", "keyword", "platform", "created_at"),
    )


class Video(Base):
    """영상 메타데이터 — 라이브러리"""
    __tablename__ = "videos"

    id = Column(String, primary_key=True)               # SHA256(url)[:16] 또는 platform video ID
    url = Column(String(1024), unique=True, nullable=False, index=True)
    platform = Column(String(20), nullable=False)
    title = Column(String(500))
    description = Column(Text)
    thumbnail_url = Column(String(1024))
    username = Column(String(200))
    category = Column(String(30), default="other", index=True)
    filepath = Column(String(1024))
    filesize_bytes = Column(Integer, default=0)
    duration_sec = Column(Integer, default=0)
    region = Column(String(10), default="US", index=True) # US, JP, KR, EU
    likes = Column(Integer, default=0)                   # 좋아요 수 (engagement)
    comments = Column(Integer, default=0)                # 댓글 수 (engagement)
    views = Column(Integer, default=0)                   # 조회 수 (engagement)
    relevance_score = Column(Float, default=5.0)
    tags = Column(Text)                                  # JSON array
    downloaded = Column(Integer, default=0)              # 0: no, 1: yes
    downloaded_at = Column(DateTime)
    created_at = Column(DateTime, default=_utcnow)

    __table_args__ = (
        Index("idx_videos_cat_dl", "category", "downloaded"),
    )


class DownloadTask(Base):
    """다운로드 큐 — 영속적, 재시작에도 유지"""
    __tablename__ = "downloads"

    id = Column(String, primary_key=True, default=_new_id)
    video_id = Column(String, nullable=False, index=True)
    url = Column(String(1024), nullable=False)
    platform = Column(String(20))
    category = Column(String(30))
    status = Column(String(20), default="queued", index=True)  # queued / downloading / done / failed
    progress = Column(Float, default=0.0)
    filepath = Column(String(1024))
    error = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)


# ─── Engine & Session ────────────────────────────────────

DB_PATH = config.base_dir / "data" / "medispa.db"
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    echo=False,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    """테이블 생성 (최초 실행 시)"""
    Base.metadata.create_all(engine)


def get_session():
    """의존성 주입용 세션"""
    return SessionLocal()
