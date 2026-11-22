#!/bin/bash
# Make a PNG preview next to every PDF in content/ and static/talks/ (needs ImageMagick).
# For talk slides, only the first page is converted (used as the thumbnail on the Talks page).
set -euo pipefail
find content static/talks -type f -name "*.pdf" 2>/dev/null | while read -r f; do
  png="${f%.pdf}.png"
  [ -f "$png" ] && continue
  if [[ "$f" == static/talks/* ]]; then
    magick -density 100 "${f}[0]" -resize 480x "$png"
  else
    magick -density 300 -trim -quality 100 "$f" "$png"
  fi
done
