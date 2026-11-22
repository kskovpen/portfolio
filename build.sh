#!/bin/bash
# Production build: Hugo site + Pagefind search index into public/
# On Netlify, DEPLOY_PRIME_URL makes deploy previews link to themselves;
# otherwise baseURL comes from hugo.toml.
set -euo pipefail
# Strava data for the Run page (skipped quietly when credentials are absent)
[ -f .env.strava ] && source .env.strava
python3 scripts/fetch_strava.py data/running.json
python3 scripts/fetch_utmb.py 4820430.kirill.skovpen data/utmb.json
hugo --cleanDestinationDir --minify ${DEPLOY_PRIME_URL:+--baseURL "$DEPLOY_PRIME_URL/"}
npx -y pagefind@1.6.0 --site public
