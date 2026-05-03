"""Check raw Apify dataset output"""
import json, sys
sys.path.insert(0, ".")
from apify_client import ApifyClient
client = ApifyClient("apify_api_REMOVED")

run_ids = {
    "youtube": "21ZOsVTX0NttJrAkC",
    "tiktok": "z7n7Va1O8R4l8xeoJ",
    "instagram": "teqtgE9bUx0FVFsfc",
}

for name, rid in run_ids.items():
    print(f"\n{'='*60}")
    print(f"📺 {name.upper()} — run_id: {rid}")
    print('='*60)
    try:
        dataset_id = rid  # For some actors, run_id IS the dataset_id
        # Try getting dataset info
        items = list(client.dataset(rid).iterate_items())
        if not items:
            # Try with run_id prefix
            items = list(client.dataset(f"{rid}").iterate_items())
        
        print(f"Items: {len(items)}")
        if items:
            item = items[0]
            print(f"\nRAW FIELDS:")
            for k, v in sorted(item.items()):
                val_str = str(v)
                if len(val_str) > 150:
                    val_str = val_str[:150] + "..."
                print(f"  {k}: {val_str}")
    except Exception as e:
        print(f"Error: {e}")
        # Try to get run info first
        try:
            run = client.run(rid).get()
            if run:
                print(f"Run info: {json.dumps(run, indent=2)[:500]}")
                if 'defaultDatasetId' in run:
                    dataset_id = run['defaultDatasetId']
                    items = list(client.dataset(dataset_id).iterate_items())
                    print(f"\nItems from dataset {dataset_id}: {len(items)}")
                    if items:
                        item = items[0]
                        print(f"\nRAW FIELDS:")
                        for k, v in sorted(item.items()):
                            val_str = str(v)
                            if len(val_str) > 150:
                                val_str = val_str[:150] + "..."
                            print(f"  {k}: {val_str}")
        except Exception as e2:
            print(f"Run info error: {e2}")
