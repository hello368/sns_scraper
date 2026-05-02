# MediSpa AI — Project Context

## Overview
Social media treatment video scraper & downloader. Searches Instagram/TikTok/Facebook/YouTube for medical spa, facial, botox, filler videos.

## Project Structure (v0.2.0 — 완전 재설계)
```
sns_scraper/
├── core/               # 공통: 설정, 에러, DB, 외부 클라이언트
├── collectors/         # 플랫폼별 검색 (Strategy Pattern)
├── processors/         # 분류, 중복 제거, AI 스코어링
├── storage/            # DB CRUD + yt-dlp 다운로드
├── api/                # FastAPI 서버 + 라우트
├── workers/            # 백그라운드 파이프라인
├── data/               # SQLite DB + 영상 저장소
└── tests/              # (준비 중)
```

## Commands
```bash
cd /mnt/c/Users/hsnam/projects/sns_scraper
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.server:app --reload --port 8000
```

## Key Design Decisions
- **Pipeline 패턴**: search → dedup → score → download (각 Stage 독립, DB 저장)
- **Strategy Pattern**: 각 플랫폼(PatformCollector)이 독립 클래스
- **계층형 에러**: ApifyAuthError → 401, ApifyQuotaError → 402, DiskFullError → 507
- **DB 중심**: 모든 상태를 SQLite에 저장 → 재시작에 강함
- **분류 = AI 우선 + 키워드 fallback**

## Rules
- Apify Starter Plan ($29/월) 보유
- DeepSeek V4 Flash (매우 저렴, Cache 최적화)
- 모든 영상 data/treatments/{category}/ 에 저장
- 중복 URL은 DB에서 자동 제거
- 디스크 90% 이상 시 다운로드 자동 중단
