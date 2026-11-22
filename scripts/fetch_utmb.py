#!/usr/bin/env python3
"""Fetch race results and UTMB index from a public UTMB runner profile.

Usage: python3 scripts/fetch_utmb.py <runner-uri> data/utmb.json
e.g.   python3 scripts/fetch_utmb.py 4820430.kirill.skovpen data/utmb.json
The profile page embeds its data as JSON (__NEXT_DATA__); if the page layout changes,
the script prints a warning and writes nothing, and the Run page simply omits UTMB data.
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone


def seconds(hms):
    h, m, s = (int(x) for x in hms.split(":"))
    return h * 3600 + m * 60 + s


def main():
    uri, out = sys.argv[1], sys.argv[2]
    url = f"https://utmb.world/en/runner/{uri}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (portfolio-site-build)"})
        html = urllib.request.urlopen(req, timeout=30).read().decode()
        props = json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S).group(1))["props"]["pageProps"]
        index = next((p["index"] for p in props.get("performanceIndexes", []) if p["piCategory"] == "general"), None)
        results = []
        for r in props["results"]["results"]:
            results.append({
                "date": r["dateIso"],
                "event": re.sub(r"\s*\(ex [^)]*\)", "", r["eventName"]).strip(),
                "race": r["raceName"].strip(),
                "distance_km": float(r["distance"]),
                "elevation_m": r.get("elevationGain"),
                "time": r["time"].lstrip("0").lstrip(":") if r.get("time") else "",
                "seconds": seconds(r["time"]) if r.get("time") else None,
                "rank": r.get("rank"),
                "total": r.get("totalRanked"),
                "dnf": bool(r.get("isDnf")),
            })
    except Exception as e:  # never break the site build because of UTMB
        print(f"fetch_utmb: failed ({e}); Run page will omit UTMB data", file=sys.stderr)
        return 0
    data = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "profile_url": url, "index": index, "results": results}
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"fetch_utmb: {len(results)} results, index {index} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
