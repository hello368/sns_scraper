"""Test YouTube raw output"""
import json, sys
sys.path.insert(0, ".")
from apify_client import ApifyClient

client = ApifyClient("apify_api_kXwYGvMFvnGFQyR2vFEbnnNP5vjGx1w8ZnnH")

# Test YouTube
run = client.actor("streamers~youtube-scraper").call(run_input={
    "searchKeywords": "botox before after",
    "maxResults": 3,
    "searchType": "video",
    "sortBy": "viewCount"
})
print(f"YouTube Run ID: {run.get('id')}")
dataset_id = run["defaultDatasetId"]
items = list(client.dataset(dataset_id).iterate_items())
print(f"YouTube Items: {len(items)}")
if items:
    item = items[0]
    print("\n=== YOUTUBE RAW FIELDS ===")
    for k, v in sorted(item.items()):
        print(f"  {k}: {v}")
    print("\n=== ENGAGEMENT CHECK ===")
    for field in ['likeCount','likes','viewCount','views','commentCount','comments','channelName','channelUsername']:
        print(f"  {field}: {item.get(field, 'MISSING')}")


# Test TikTok
run2 = client.actor("clockworks~tiktok-scraper").call(run_input={
    "searchQueries": ["botox"],
    "maxResults": 3,
    "resultsLimit": 3,
    "scrapeVideoMetadata": True,
})
print(f"\nTikTok Run ID: {run2.get('id')}")
dataset_id2 = run2["defaultDatasetId"]
items2 = list(client.dataset(dataset_id2).iterate_items())
print(f"TikTok Items: {len(items2)}")
if items2:
    item2 = items2[0]
    print("\n=== TIKTOK RAW FIELDS ===")
    for k, v in sorted(item2.items()):
        print(f"  {k}: {v}")
    print("\n=== ENGAGEMENT CHECK ===")
    for field in ['diggCount','likeCount','commentCount','playCount','shareCount','authorMeta','videoMeta']:
        val = item2.get(field, 'MISSING')
        if isinstance(val, dict):
            print(f"  {field}: {json.dumps(val)[:200]}")
        else:
            print(f"  {field}: {val}")


# Test Instagram
run3 = client.actor("apify~instagram-hashtag-scraper").call(run_input={
    "hashtags": ["botox"],
    "resultsLimit": 3,
})
print(f"\nInstagram Run ID: {run3.get('id')}")
dataset_id3 = run3["defaultDatasetId"]
items3 = list(client.dataset(dataset_id3).iterate_items())
print(f"Instagram Items: {len(items3)}")
if items3:
    item3 = items3[0]
    print("\n=== INSTAGRAM RAW FIELDS ===")
    for k, v in sorted(item3.items()):
        print(f"  {k}: {v}")
    print("\n=== ENGAGEMENT CHECK ===")
    for field in ['likesCount','likeCount','commentsCount','commentCount','videoViewCount','viewCount','ownerUsername','username','displayUrl','type','caption']:
        val = item3.get(field, 'MISSING')
        if isinstance(val, str) and len(val) > 200:
            print(f"  {field}: {val[:200]}...")
        else:
            print(f"  {field}: {val}")
