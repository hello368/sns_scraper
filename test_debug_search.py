"""직접 Apify에서 데이터 받아서 필드 확인"""
import sys, os, json
sys.path.insert(0, "/mnt/c/Users/hsnam/projects/sns_scraper")
os.chdir("/mnt/c/Users/hsnam/projects/sns_scraper")

# Use the same apify_client init as the app
from apify_client import ApifyClient

# Read token from .env
from dotenv import load_dotenv
load_dotenv()
token = os.getenv("APIFY_TOKEN")
if not token:
    # Try the one from config
    from core.config import config
    token = config.apify_token

print(f"Token loaded: {token[:20]}...{token[-4:]}")

client = ApifyClient(token)

# ===== TEST YOUTUBE =====
print("\n" + "="*60)
print("TESTING YOUTUBE")
print("="*60)
try:
    run = client.actor("streamers~youtube-scraper").call(run_input={
        "searchKeywords": "botox injection",
        "maxResults": 5,
        "searchType": "video",
        "sortBy": "viewCount",
    })
    print(f"YouTube run: {run.get('id')}")
    dataset_id = run["defaultDatasetId"]
    items = list(client.dataset(dataset_id).iterate_items())
    print(f"Items: {len(items)}")
    for i, item in enumerate(items[:3]):
        print(f"\n--- Item {i} ---")
        for k, v in sorted(item.items()):
            if isinstance(v, dict):
                print(f"  RAW.{k}: {{...}}")
            else:
                print(f"  RAW.{k}: {str(v)[:100]}")
        print(f"  >>> likeCount={item.get('likeCount','MISSING')} viewCount={item.get('viewCount','MISSING')} commentCount={item.get('commentCount','MISSING')}")
except Exception as e:
    print(f"YouTube failed: {e}")

# ===== TEST TIKTOK =====
print("\n" + "="*60)
print("TESTING TIKTOK")
print("="*60)
try:
    run = client.actor("clockworks~tiktok-scraper").call(run_input={
        "searchQueries": ["botox"],
        "maxResults": 5,
        "resultsLimit": 5,
        "scrapeVideoMetadata": True,
    })
    print(f"TikTok run: {run.get('id')}")
    dataset_id = run["defaultDatasetId"]
    items = list(client.dataset(dataset_id).iterate_items())
    print(f"Items: {len(items)}")
    for i, item in enumerate(items[:3]):
        print(f"\n--- Item {i} ---")
        for k, v in sorted(item.items()):
            if isinstance(v, dict):
                val_str = json.dumps(v)[:200]
                print(f"  RAW.{k}: {val_str}")
            else:
                print(f"  RAW.{k}: {str(v)[:100]}")
        print(f"  >>> diggCount={item.get('diggCount','MISSING')} playCount={item.get('playCount','MISSING')} commentCount={item.get('commentCount','MISSING')}")
except Exception as e:
    print(f"TikTok failed: {e}")

# ===== TEST INSTAGRAM =====
print("\n" + "="*60)
print("TESTING INSTAGRAM")
print("="*60)
try:
    run = client.actor("apify~instagram-hashtag-scraper").call(run_input={
        "hashtags": ["botox"],
        "resultsLimit": 5,
    })
    print(f"Instagram run: {run.get('id')}")
    dataset_id = run["defaultDatasetId"]
    items = list(client.dataset(dataset_id).iterate_items())
    print(f"Items: {len(items)}")
    for i, item in enumerate(items[:3]):
        print(f"\n--- Item {i} ---")
        for k, v in sorted(item.items()):
            if isinstance(v, dict):
                val_str = json.dumps(v)[:200]
                print(f"  RAW.{k}: {val_str}")
            elif isinstance(v, str) and len(v) > 100:
                print(f"  RAW.{k}: {v[:100]}...")
            else:
                print(f"  RAW.{k}: {str(v)[:100]}")
        print(f"  >>> likesCount={item.get('likesCount','MISSING')} commentsCount={item.get('commentsCount','MISSING')} videoViewCount={item.get('videoViewCount','MISSING')}")
except Exception as e:
    print(f"Instagram failed: {e}")
