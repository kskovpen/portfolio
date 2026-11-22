#!/bin/bash
# Local dev: build a search index into static/ (hugo server serves from memory), then serve
set -euo pipefail
hugo --quiet
npx -y pagefind@1.6.0 --site public --output-path static/pagefind
hugo server --disableFastRender
