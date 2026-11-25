#!/usr/bin/env python3
"""Fetch listening data from a public Deezer profile for the Music page.

Uses Deezer's public API (no login, no key): works while the profile is public
(Deezer > Settings > Privacy > "Private profile" off).
Writes: top artists, most-played tracks and albums, recently added favourite albums,
and a genre mix computed from those albums. Images stay on Deezer's servers (only URLs are stored).

Usage: python3 scripts/fetch_deezer.py USER_ID data/deezer.json
On failure the old file is kept, and the page simply hides the section if there is none.
"""
import json
import sys
import time
import urllib.request
from collections import Counter
from datetime import datetime, timezone

API = "https://api.deezer.com"


def get(path):
    req = urllib.request.Request(API + path, headers={"User-Agent": "portfolio-site-build"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(data["error"].get("message", "Deezer API error"))
    return data


def artist(a):
    return {"id": a["id"], "name": a["name"], "link": a.get("link") or f"https://www.deezer.com/artist/{a['id']}",
            "picture": a.get("picture_big") or a.get("picture_medium") or ""}


def album(a):
    return {"id": a["id"], "title": a["title"], "artist": (a.get("artist") or {}).get("name", ""),
            "link": a.get("link") or f"https://www.deezer.com/album/{a['id']}",
            "cover": a.get("cover_big") or a.get("cover_medium") or "",
            "added": datetime.fromtimestamp(a["time_add"], timezone.utc).strftime("%Y-%m-%d") if a.get("time_add") else ""}


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    user, out = sys.argv[1], sys.argv[2]
    try:
        profile = get(f"/user/{user}")
        top_artists = [artist(a) for a in get(f"/user/{user}/charts/artists?limit=20")["data"]]
        top_tracks = [{
            "id": t["id"], "title": t["title"], "artist": t["artist"]["name"],
            "album": t["album"]["title"], "cover": t["album"].get("cover_medium") or "",
            "link": f"https://www.deezer.com/track/{t['id']}", "duration": t.get("duration", 0),
        } for t in get(f"/user/{user}/charts/tracks?limit=20")["data"]]
        top_albums_raw = get(f"/user/{user}/charts/albums?limit=20")["data"]
        fav_albums_raw = sorted(get(f"/user/{user}/albums?limit=200")["data"],
                                key=lambda a: a.get("time_add", 0), reverse=True)
        fav_artists = get(f"/user/{user}/artists?limit=1")
        fav_tracks = get(f"/user/{user}/tracks?limit=1")

        # genre mix from the albums actually played plus the most recently saved ones
        genres = Counter()
        seen = set()
        for a in top_albums_raw + fav_albums_raw[:40]:
            if a["id"] in seen:
                continue
            seen.add(a["id"])
            try:
                info = get(f"/album/{a['id']}")
            except Exception:
                continue
            for g in (info.get("genres") or {}).get("data", [])[:1]:   # main genre only
                genres[g["name"]] += 1
            time.sleep(0.12)  # stay well under Deezer's 50 requests / 5 s
        total = sum(genres.values()) or 1
        genre_mix = [{"name": n, "count": c, "share": round(100 * c / total)} for n, c in genres.most_common(8)]
    except Exception as e:
        print(f"fetch_deezer: skipped ({e}); keeping previous data", file=sys.stderr)
        return

    data = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "profile_url": profile.get("link") or f"https://www.deezer.com/profile/{user}",
        "counts": {"artists": fav_artists.get("total", 0), "albums": len(fav_albums_raw), "tracks": fav_tracks.get("total", 0)},
        "top_artists": top_artists,
        "top_tracks": top_tracks,
        "top_albums": [album(a) for a in top_albums_raw],
        "recent_albums": [album(a) for a in fav_albums_raw[:12]],
        "genres": genre_mix,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"fetch_deezer: {len(top_artists)} top artists, {len(top_tracks)} tracks, {len(genre_mix)} genres")


if __name__ == "__main__":
    main()
