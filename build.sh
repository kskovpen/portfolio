#!/bin/bash
# Production build: Hugo site + Pagefind search index into public/
# On Cloudflare Pages, preview builds (branches other than main) link to themselves;
# otherwise baseURL comes from hugo.toml.
set -euo pipefail
# Strava data for the Run page (skipped quietly when credentials are absent)
[ -f .env.strava ] && source .env.strava
python3 scripts/fetch_utmb.py 4820430.kirill.skovpen data/utmb.json
python3 scripts/fetch_strava.py data/running.json
PREVIEW_URL=""
[ -n "${CF_PAGES_BRANCH:-}" ] && [ "$CF_PAGES_BRANCH" != "main" ] && PREVIEW_URL="$CF_PAGES_URL/"
hugo --cleanDestinationDir --minify ${PREVIEW_URL:+--baseURL "$PREVIEW_URL"}
# The editor (static/admin) is for local use only; keep it off the published site
rm -rf public/admin
npx -y pagefind@1.6.0 --site public
