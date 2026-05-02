"""
시스템 상태 / 키워드 생성 API
"""
from __future__ import annotations
import shutil
import json
from fastapi import APIRouter
from api.schemas import KeywordRequest

from core.config import config, apify_configured, deepseek_configured
from core.client import get_deepseek_client
from storage.repository import Repository

router = APIRouter(tags=["system"])


@router.get("/status")
def system_status():
    """시스템 상태 확인"""
    repo = Repository()
    stats = repo.get_library_stats()
    total, used, free = shutil.disk_usage(config.data_dir)
    pending = len(repo.get_pending_downloads())

    return {
        "status": "ok",
        "apify_configured": apify_configured,
        "deepseek_configured": deepseek_configured,
        "total_videos": stats.get("total_videos", 0),
        "downloaded_videos": stats.get("downloaded", 0),
        "pending_downloads": pending,
        "disk_usage_pct": round((used / total) * 100, 1),
        "disk_free_gb": round(free / (1024**3), 1),
    }


@router.post("/keywords")
def generate_keywords(req: KeywordRequest):
    """AI 키워드 확장 생성"""
    seeds = req.seeds
    client = get_deepseek_client()
    if not client:
        return {"keywords": seeds, "count": len(seeds), "method": "seed"}

    try:
        resp = client.chat.completions.create(
            model=config.deepseek_model,
            messages=[{
                "role": "system",
                "content": "Generate 15 search queries for treatment videos. JSON: {\"queries\":[...]}",
            }, {
                "role": "user",
                "content": json.dumps({"task": "expand_keywords", "seeds": seeds}),
            }],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        data = json.loads(resp.choices[0].message.content)
        expanded = data.get("queries", data.get("keywords", seeds))
        # 중복 제거 + 순서 유지
        all_kw = list(dict.fromkeys(seeds + expanded))
        return {"keywords": all_kw, "count": len(all_kw), "method": "ai"}
    except Exception as e:
        return {"keywords": seeds, "method": "seed", "error": str(e)}
