#!/usr/bin/env python3
"""Static map snapshots for the Travel section (needs Pillow: pip install pillow).

For every trip in content/travel/<trip>/index.md with `places = [{name, lat, lon}, ...]`
this writes content/travel/<trip>/map.jpg, plus static/travel/overview.jpg with all places.
Existing images are kept unless --force is given (or the trip's places changed), so the
OpenStreetMap tile servers are only contacted when a trip is added or edited.
Map data (c) OpenStreetMap contributors; tiles from tile.openstreetmap.org (usage policy:
low volume, identified client, attribution shown under each image).

Usage: python3 scripts/map_snapshots.py [--force]
"""
import hashlib
import json
import math
import os
import sys
import time
import tomllib
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

TILE = 256
W, H = 1200, 640
UA = "kskovpen-portfolio-map-snapshots/1.0 (personal website; low volume)"
CACHE = Path.home() / ".cache" / "portfolio-osm-tiles"
TEAL, WHITE = (0, 144, 156), (255, 255, 255)


def lonlat_to_px(lon, lat, z):
    n = TILE * 2 ** z
    x = (lon + 180) / 360 * n
    lat_r = math.radians(max(min(lat, 85), -85))
    y = (1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n
    return x, y


def tile(z, x, y):
    x %= 2 ** z
    path = CACHE / f"{z}/{x}/{y}.png"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(f"https://tile.openstreetmap.org/{z}/{x}/{y}.png", headers={"User-Agent": UA})
        path.write_bytes(urllib.request.urlopen(req, timeout=30).read())
        time.sleep(0.2)  # be gentle
    return Image.open(path).convert("RGB")


def render(points, out, max_zoom=12):
    lats = [p["lat"] for p in points]
    lons = [p["lon"] for p in points]
    pad = 80
    z = max_zoom
    while z > 1:
        x0, y1 = lonlat_to_px(min(lons), min(lats), z)
        x1, y0 = lonlat_to_px(max(lons), max(lats), z)
        if x1 - x0 <= W - 2 * pad and y1 - y0 <= H - 2 * pad:
            break
        z -= 1
    cx = (min(lonlat_to_px(l, 0, z)[0] for l in lons) + max(lonlat_to_px(l, 0, z)[0] for l in lons)) / 2
    cy = (min(lonlat_to_px(0, l, z)[1] for l in lats) + max(lonlat_to_px(0, l, z)[1] for l in lats)) / 2
    left, top = cx - W / 2, cy - H / 2
    img = Image.new("RGB", (W, H))
    for tx in range(int(left // TILE), int((left + W) // TILE) + 1):
        for ty in range(int(top // TILE), int((top + H) // TILE) + 1):
            if 0 <= ty < 2 ** z:
                img.paste(tile(z, tx, ty), (int(tx * TILE - left), int(ty * TILE - top)))
    d = ImageDraw.Draw(img)
    for p in points:
        x, y = lonlat_to_px(p["lon"], p["lat"], z)
        x, y = x - left, y - top
        d.ellipse([x - 11, y - 11, x + 11, y + 11], fill=WHITE)
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=TEAL)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, quality=82, optimize=True, progressive=True)
    print(f"map_snapshots: wrote {out} (zoom {z}, {len(points)} places)")


def front_matter(md):
    text = md.read_text()
    if not text.startswith("+++"):
        return {}
    return tomllib.loads(text.split("+++", 2)[1])


def main():
    force = "--force" in sys.argv
    root = Path(__file__).resolve().parent.parent
    state_file = root / "scripts" / "map_snapshots.json"   # places hash per image, so unchanged maps are not redrawn
    state = json.loads(state_file.read_text()) if state_file.exists() else {}
    all_points = []
    for md in sorted((root / "content" / "travel").glob("*/index.md")):
        fm = front_matter(md)
        if fm.get("draft"):
            continue
        pts = [p for p in fm.get("places", []) if "lat" in p and "lon" in p]
        if not pts:
            continue
        all_points += pts
        out = md.parent / "map.jpg"
        key = str(out.relative_to(root))
        h = hashlib.sha1(json.dumps(pts, sort_keys=True).encode()).hexdigest()
        if force or not out.exists() or state.get(key) != h:
            render(pts, out)
            state[key] = h
    if all_points:
        out = root / "static" / "travel" / "overview.jpg"
        key = str(out.relative_to(root))
        h = hashlib.sha1(json.dumps(all_points, sort_keys=True).encode()).hexdigest()
        if force or not out.exists() or state.get(key) != h:
            render(all_points, out, max_zoom=10)
            state[key] = h
    state_file.write_text(json.dumps(state, indent=1, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
