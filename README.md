# MediSpa AI — 소셜미디어 트리트먼트 영상 수집 시스템

Medical spa, facial, botox, filler 트리트먼트 영상을 Instagram/TikTok/Facebook/YouTube에서 자동 검색 + 다운로드.

## Architecture

```
collectors/     → 플랫폼별 검색 전략 (Strategy Pattern)
processors/     → 분류 / 중복 제거 / AI 스코어링
storage/        → DB CRUD + yt-dlp 다운로드
api/            → FastAPI REST API
workers/        → 백그라운드 파이프라인
core/           → 설정, 에러, 외부 클라이언트
```

## Quick Start

```bash
cp .env.example .env   # API 키 입력
pip install -r requirements.txt
python -c "from core.models import init_db; init_db()"  # DB 생성
uvicorn api.server:app --reload --port 8000
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search` | POST | 모든 플랫폼 검색 |
| `/download` | POST | 영상 다운로드 큐 추가 |
| `/library/stats` | GET | 라이브러리 통계 |
| `/library/videos` | GET | 영상 목록 조회 |
| `/status` | GET | 시스템 상태 |
| `/keywords` | POST | AI 키워드 확장 |

## Tech Stack

- **Apify API** — 검색 (Starter Plan)
- **yt-dlp** — 다운로드
- **DeepSeek V4 Flash** — AI 분류/스코어링
- **SQLite + SQLAlchemy** — 데이터 저장
- **FastAPI** — REST API
- **Next.js + shadcn/ui** — 프론트엔드 (준비 중)
