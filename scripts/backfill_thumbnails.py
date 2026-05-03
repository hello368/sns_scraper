"""
기존 영상 중 썸네일 없는 것 → oEmbed API로 백필
"""
import sys, os, json, time, re
sys.path.insert(0, os.path.dirname(os.path.abspath('.')))
os.chdir(os.path.dirname(os.path.abspath('.')))
from pathlib import Path

# Find the project directory
for p in ['/mnt/c/Users/hsnam/projects/sns_scraper', '.']:
    if (Path(p) / 'data' / 'medispa.db').exists():
        os.chdir(p)
        break

from urllib.parse import quote
import sqlite3
import urllib.request

DB = Path('data/medispa.db')
assert DB.exists(), f"DB not found: {DB}"

conn = sqlite3.connect(str(DB))
conn.row_factory = sqlite3.Row

# Find videos without thumbnails
rows = conn.execute("""
    SELECT id, url, platform, title FROM videos
    WHERE thumbnail_url IS NULL OR thumbnail_url = ''
    ORDER BY created_at DESC
""").fetchall()

print(f"📦 Videos missing thumbnails: {len(rows)}")
updated = 0

for idx, r in enumerate(rows):
    vid_id = r["id"]
    url = r["url"]
    platform = r["platform"]

    thumbnail = None

    if platform == "tiktok":
        # Try TikTok oEmbed
        oembed_url = f"https://www.tiktok.com/oembed?url={quote(url)}"
        try:
            req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read())
                thumbnail = data.get("thumbnail_url") or data.get("thumbnail")
        except Exception:
            pass

        # Fallback: extract video ID from URL and construct thumbnail
        if not thumbnail:
            match = re.search(r'/video/(\d+)', url)
            if match:
                vid = match.group(1)
                # TikTok CDN thumbnail pattern
                possible = [
                    f"https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/{vid}~tplv-tiktokx-share-play.jpeg",
                    f"https://www.tiktok.com/api/img/?itemId={vid}",
                ]
                for pu in possible:
                    try:
                        req = urllib.request.Request(pu, method="HEAD")
                        with urllib.request.urlopen(req, timeout=3):
                            thumbnail = pu
                            break
                    except Exception:
                        continue

    elif platform == "instagram":
        # Try Instagram oEmbed
        oembed_url = f"https://api.instagram.com/oembed?url={quote(url)}"
        try:
            req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read())
                thumbnail = data.get("thumbnail_url")
        except Exception:
            pass

        # Fallback: extract shortCode
        if not thumbnail:
            match = re.search(r'/p/([^/?#]+)', url)
            if match:
                short_code = match.group(1)
                # Try direct CDN
                thumbnail = f"https://www.instagram.com/p/{short_code}/media/?size=l"

    if thumbnail:
        conn.execute("UPDATE videos SET thumbnail_url = ? WHERE id = ?", (thumbnail, vid_id))
        updated += 1
        print(f"  ✅ [{idx+1}/{len(rows)}] {platform:10} thumbnail recovered")
    else:
        print(f"  ❌ [{idx+1}/{len(rows)}] {platform:10} no thumbnail found")

    time.sleep(0.3)  # rate limit

conn.commit()
print(f"\n✅ Backfill complete: {updated}/{len(rows)} recovered")
conn.close()
