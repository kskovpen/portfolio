#!/bin/bash
# Local dev: build a search index into static/ (hugo server serves from memory), then serve
set -euo pipefail
# Strava data for the Run page (skipped quietly when credentials are absent)
[ -f .env.strava ] && source .env.strava
python3 scripts/fetch_strava.py data/running.json
hugo --quiet
npx -y pagefind@1.6.0 --site public --output-path static/pagefind
hugo server --disableFastRender
