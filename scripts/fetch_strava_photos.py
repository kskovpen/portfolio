#!/usr/bin/env python3
"""Download photos attached to public Strava runs into photos/strava/ (git-ignored).

Personal photos are never committed to GitHub. This runs on this Mac only;
the Running page shows them when the folder exists (Hugo mounts photos/ as assets/photos).

Every photo is re-encoded without EXIF (no GPS, no camera data).
Writes photos/strava/manifest.json in display order: the most colourful photo first
(used as the large tile), then the rest alternating between runs, newest first.

Needs the same env vars as fetch_strava.py (source .env.strava first).
Usage: python3 scripts/fetch_strava_photos.py
"""
import io
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import fetch_strava as fs  # noqa: E402

try:
    from PIL import Image, ImageOps, ImageStat
except ImportError:
    sys.exit("fetch_strava_photos: needs Pillow (pip3 install Pillow)")

OUT = "photos/strava"


def colourfulness(im):
    """Hasler–Süsstrunk colourfulness metric on a small copy."""
    small = im.copy()
    small.thumbnail((200, 200))
    px = list(small.getdata())
    rg = [r - g for r, g, b in px]
    yb = [0.5 * (r + g) - b for r, g, b in px]
    def mean_sd(v):
        m = sum(v) / len(v)
        return m, (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5
    (mrg, srg), (myb, syb) = mean_sd(rg), mean_sd(yb)
    return (srg ** 2 + syb ** 2) ** 0.5 + 0.3 * (mrg ** 2 + myb ** 2) ** 0.5


def main():
    for v in ("STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REFRESH_TOKEN"):
        if not os.environ.get(v):
            sys.exit("fetch_strava_photos: Strava credentials missing (source .env.strava)")
    token = fs.access_token()
    runs = [a for a in fs.all_activities(token)
            if a["type"] in fs.RUN_TYPES and a.get("visibility") == "everyone" and a.get("total_photo_count")]
    runs.sort(key=lambda a: a["start_date_local"], reverse=True)

    per_run = []
    for a in runs:
        photos = fs.request(f"{fs.API}/activities/{a['id']}/photos?size=2048&photo_sources=true", token=token)
        folder = f"{OUT}/{a['id']}"
        os.makedirs(folder, exist_ok=True)
        items = []
        for i, p in enumerate(photos, 1):
            urls = p.get("urls") or {}
            if not urls:
                continue
            path = f"{folder}/{i}.jpg"
            if not os.path.exists(path):
                url = urls[max(urls, key=int)]
                req = urllib.request.Request(url, headers={"User-Agent": "portfolio-site-build"})
                raw = urllib.request.urlopen(req, timeout=60).read()
                img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
                img.save(path, "JPEG", quality=90)  # saved without EXIF
            img = Image.open(path).convert("RGB")
            items.append({
                "activity": a["id"], "url": f"https://www.strava.com/activities/{a['id']}",
                "date": a["start_date_local"][:10], "name": a["name"],
                "km": round(a["distance"] / 1000, 1), "elevation_m": round(a.get("total_elevation_gain") or 0),
                "file": path, "width": img.width, "height": img.height,
                "caption": p.get("caption") or "", "colour": round(colourfulness(img), 1),
            })
        if items:
            per_run.append(items)

    flat = [p for run in per_run for p in run]
    if not flat:
        print("fetch_strava_photos: no photos on public runs")
        return
    hero = max(flat, key=lambda p: p["colour"])
    order = [hero]
    queues = [[p for p in run if p is not hero] for run in per_run]
    while any(queues):
        for q in queues:
            if q:
                order.append(q.pop(0))
    with open(f"{OUT}/manifest.json", "w", encoding="utf-8") as f:
        json.dump(order, f, indent=1, ensure_ascii=False)
    print(f"fetch_strava_photos: {len(order)} photos from {len(per_run)} runs")


if __name__ == "__main__":
    main()
