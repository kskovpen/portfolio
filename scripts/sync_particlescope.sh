#!/bin/sh
# Copy the ParticleScope browser app into static/particlescope/ (served at /particlescope/).
# The app's source of truth is its own repo; rerun this after app changes.
set -e
SRC="${PARTICLESCOPE_SRC:-$HOME/Work/GPU/muonchamber}"
DST="$(dirname "$0")/../static/particlescope"
[ -f "$SRC/index.html" ] || { echo "ParticleScope not found at $SRC"; exit 1; }
mkdir -p "$DST"
rsync -a --delete "$SRC/index.html" "$SRC/src" "$SRC/assets" "$DST/"
echo "ParticleScope synced from $SRC ($(cd "$SRC" && git rev-parse --short HEAD 2>/dev/null || echo 'no git'))"
