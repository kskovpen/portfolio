#!/bin/bash
# Production build: Hugo site + Pagefind search index into public/
set -euo pipefail
hugo --cleanDestinationDir --minify
npx -y pagefind@1.6.0 --site public
