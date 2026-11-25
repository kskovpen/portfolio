#!/usr/bin/env python3
"""Fetch my releases from SoundCloud into data/soundcloud.json for the Music page.

Reads only the public SoundCloud pages (the same data a browser receives) and the public
waveform files, so no API key is needed. Tracks that belong to an album/EP are grouped under
it; the rest become singles. On any error the existing data file is left untouched.

    python3 scripts/fetch_soundcloud.py kirillskovpenmusic data/soundcloud.json
"""
import json, re, sys, time, urllib.request
from datetime import datetime, timezone

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; personal website build)"}
BARS = 80  # bars per waveform on the page


def fetch(url, as_json=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        body = r.read().decode()
    return json.loads(body) if as_json else body


def hydration(path):
    html = fetch("https://soundcloud.com/" + path)
    m = re.search(r"window\.__sc_hydration = (\[.*?\]);</script>", html, re.S)
    if not m:
        raise RuntimeError("no page data on " + path)
    data = {x["hydratable"]: x.get("data") for x in json.loads(m.group(1))}
    return data, html


def links(html, user, kind):
    """Permalinks of tracks (kind='track') or sets (kind='set') linked from a profile page."""
    found = []
    for href in re.findall(r'href="/%s/([^"]+)"' % re.escape(user), html):
        if kind == "set" and href.startswith("sets/") and href.count("/") == 1:
            found.append(href)
        if kind == "track" and "/" not in href and href not in ("tracks", "sets", "albums", "likes", "comments", "reposts", "popular-tracks", "followers", "following"):
            found.append(href)
    return list(dict.fromkeys(found))


def waveform(url):
    try:
        w = fetch(url, as_json=True)
    except Exception:
        return []
    s, h = w["samples"], float(w.get("height") or 140)
    step = len(s) / BARS
    return [round(100 * max(s[int(i * step):max(int((i + 1) * step), int(i * step) + 1)]) / h) for i in range(BARS)]


def big_art(url):
    return url.replace("-large.", "-t500x500.") if url else None


def split_title(title, me):
    """'Brad Sucks - Never Get Out (Kirill Skovpen remix)' -> title, artist, note."""
    t = re.sub(r"^\d+\.\s*", "", title).strip()
    artist, note = None, None
    if " - " in t:
        a, rest = t.split(" - ", 1)
        if a.strip().lower() != me.lower():
            artist = a.strip()
        t = rest.strip()
    m = re.search(r"\s*\(([^)]*)\)\s*$", t)
    if m:
        inner = m.group(1)
        if re.search(r"remix", inner, re.I):
            note = "remix"
            t = t[: m.start()].strip()
        elif re.match(r"original by", inner, re.I):
            note = "cover:" + re.sub(r"(?i)^original by\s*", "", inner).strip()
            t = t[: m.start()].strip()
    return t, artist, note


def track_info(sound, me):
    title, artist, note = split_title(sound["title"], me)
    return {
        "id": sound["id"],
        "title": title,
        "artist": artist,
        "note": note,
        "url": sound["permalink_url"],
        "duration": round(sound.get("full_duration") or sound["duration"]) // 1000,
        "plays": sound.get("playback_count") or 0,
        "likes": sound.get("likes_count") or 0,
        "genre": sound.get("genre") or None,
        "date": sound.get("release_date") or sound.get("display_date") or sound.get("created_at"),
        "artwork": big_art(sound.get("artwork_url")),
        "wave": waveform(sound["waveform_url"]) if sound.get("waveform_url") else [],
        "extra": "",
    }


def main(user, out):
    prof, html = hydration(user)
    me = prof["user"].get("username") or user
    track_pages = links(hydration(user + "/tracks")[1], user, "track") or links(html, user, "track")
    set_pages = []
    for p in ("sets", "albums"):
        set_pages += links(hydration(user + "/" + p)[1], user, "set")
    set_pages = list(dict.fromkeys(set_pages))

    tracks = {}
    for p in track_pages:
        time.sleep(0.5)
        s = hydration(user + "/" + p)[0].get("sound")
        if s and s.get("user_id") == prof["user"]["id"]:
            tracks[s["id"]] = track_info(s, me)

    releases, used = [], set()
    for p in set_pages:
        time.sleep(0.5)
        pl = hydration(user + "/" + p)[0].get("playlist")
        if not pl:
            continue
        items = [tracks[t["id"]] for t in pl["tracks"] if t.get("id") in tracks]
        if not items:
            continue
        used.update(t["id"] for t in items)
        kind = (pl.get("set_type") or "").lower() or ("ep" if re.search(r"\bEP\b", pl["title"]) else "album")
        releases.append({
            "kind": kind if kind in ("ep", "album", "single", "compilation") else "album",
            "title": re.sub(r"\s+EP\s*$", "", pl["title"]).strip(),
            "url": pl["permalink_url"],
            "date": pl.get("release_date") or pl.get("display_date") or pl.get("created_at"),
            "artwork": big_art(pl.get("artwork_url")) or items[0]["artwork"],
            "genre": pl.get("genre") or items[0]["genre"],
            "tracks": items,
        })
    for t in tracks.values():
        if t["id"] not in used:
            releases.append({"kind": "single", "title": t["title"], "url": t["url"], "date": t["date"],
                             "artwork": t["artwork"], "genre": t["genre"], "tracks": [t]})

    for r in releases:
        r["year"] = int(r["date"][:4])
        r["duration"] = sum(t["duration"] for t in r["tracks"])
        r["plays"] = sum(t["plays"] for t in r["tracks"])
        r["remixes"] = all(t["note"] == "remix" or (t["note"] or "").startswith("cover:") for t in r["tracks"])
        for t in r["tracks"]:
            t.pop("extra")
    releases.sort(key=lambda r: r["date"], reverse=True)

    data = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "profile_url": prof["user"]["permalink_url"],
        "followers": prof["user"].get("followers_count"),
        "releases": releases,
    }
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"SoundCloud: {len(releases)} releases, {len(tracks)} tracks -> {out}")


if __name__ == "__main__":
    try:
        main(sys.argv[1] if len(sys.argv) > 1 else "kirillskovpenmusic",
             sys.argv[2] if len(sys.argv) > 2 else "data/soundcloud.json")
    except Exception as e:  # keep the previous data and let the build continue
        print("SoundCloud fetch failed, keeping existing data:", e, file=sys.stderr)
