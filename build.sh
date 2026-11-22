#!/bin/bash
# Production build: Hugo site + Pagefind search index into public/
# On Netlify, DEPLOY_PRIME_URL makes deploy previews link to themselves;
# otherwise baseURL comes from hugo.toml.
set -euo pipefail
hugo --cleanDestinationDir --minify ${DEPLOY_PRIME_URL:+--baseURL "$DEPLOY_PRIME_URL/"}
npx -y pagefind@1.6.0 --site public
