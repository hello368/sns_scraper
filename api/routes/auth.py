"""
인증 API 라우트 — 로그인, 회원가입, 사용자 관리
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from core.models import User, get_session, init_db
from core.auth import (
    hash_password, verify_password, create_token,
    get_current_user, require_admin,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Schemas ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: int
    created_at: Optional[str] = ""
    last_login: Optional[str] = ""

class TokenResponse(BaseModel):
    token: str
    user: UserResponse


# ─── Seeding ─────────────────────────────────────────────

def seed_admin(session: Session = None):
    """최초 실행 시 admin 계정 자동 생성"""
    from core.models import SessionLocal
    close = False
    if session is None:
        session = SessionLocal()
        close = True
    try:
        existing = session.query(User).filter(User.username == "admin").first()
        if not existing:
            admin = User(
                username="admin",
                email="admin@medispa.ai",
                hashed_password=hash_password("admin123"),
                role="admin",
            )
            session.add(admin)
            session.commit()
            print("✅ Admin account created (admin / admin123)")
    finally:
        if close:
            session.close()


# ─── Routes ──────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, session: Session = Depends(get_session)):
    """로그인 → JWT 토큰 반환"""
    user = session.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    user.last_login = datetime.now(timezone.utc)
    session.commit()

    token = create_token(user.id, user.role)
    return TokenResponse(
        token=token,
        user=_user_to_response(user),
    )


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, session: Session = Depends(get_session)):
    """회원가입 (client 계정 생성)"""
    if session.query(User).filter(User.username == req.username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Username taken")
    if session.query(User).filter(User.email == req.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email taken")

    user = User(
        username=req.username,
        email=req.email,
        hashed_password=hash_password(req.password),
        role="user",
    )
    session.add(user)
    session.commit()

    token = create_token(user.id, user.role)
    return TokenResponse(
        token=token,
        user=_user_to_response(user),
    )


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보"""
    return _user_to_response(user)


# ─── Admin Routes ────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
def list_users(
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """전체 사용자 목록 (관리자 전용)"""
    users = session.query(User).order_by(User.created_at.desc()).all()
    return [_user_to_response(u) for u in users]


class CreateUserRequest(BaseModel):
    username: str
    password: str
    email: str
    role: str = "user"

@router.post("/users", response_model=UserResponse)
def create_user(
    req: CreateUserRequest,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """새 사용자 생성 (관리자 전용)"""
    if session.query(User).filter(User.username == req.username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Username taken")
    user = User(
        username=req.username,
        email=req.email,
        hashed_password=hash_password(req.password),
        role=req.role,
        created_by=admin.username,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return _user_to_response(user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """사용자 삭제 (관리자 전용)"""
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete yourself")
    session.delete(user)
    session.commit()
    return {"status": "deleted", "user_id": user_id}


@router.patch("/users/{user_id}/toggle")
def toggle_user(
    user_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """사용자 활성/비활성 전환 (관리자 전용)"""
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot toggle yourself")
    user.is_active = 0 if user.is_active else 1
    session.commit()
    return _user_to_response(user)


# ─── Helpers ─────────────────────────────────────────────

def _user_to_response(u: User) -> UserResponse:
    return UserResponse(
        id=u.id,
        username=u.username,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        created_at=str(u.created_at)[:19] if u.created_at else "",
        last_login=str(u.last_login)[:19] if u.last_login else "",
    )
