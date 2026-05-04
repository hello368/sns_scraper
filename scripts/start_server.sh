#!/bin/bash
cd /mnt/c/Users/hsnam/projects/sns_scraper
source .venv/bin/activate
exec uvicorn api.server:app --host 0.0.0.0 --port 8000
