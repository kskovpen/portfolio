#!/bin/bash
# Local dev: build a search index into static/ (hugo server serves from memory), then serve
set -euo pipefail
# Strava data for the Run page (skipped quietly when credentials are absent)
[ -f .env.strava ] && source .env.strava
python3 scripts/fetch_utmb.py 4820430.kirill.skovpen data/utmb.json
python3 scripts/fetch_strava.py data/running.json
python3 scripts/fetch_strava_photos.py || echo "Strava photos skipped"
python3 scripts/map_snapshots.py || echo "map snapshots skipped (needs Pillow)"
hugo --quiet
npx -y pagefind@1.6.0 --site public --output-path static/pagefind
hugo server --disableFastRender --renderToMemory --buildDrafts
