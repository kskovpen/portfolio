#!/usr/bin/env python3
"""Fetch public Strava runs and write a summary JSON for the Run page.

Needs env vars STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN
(see scripts/strava_auth.py). Only activities with visibility "everyone" are used;
no maps or start locations are written.

Usage: python3 scripts/fetch_strava.py data/running.json
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

API = "https://www.strava.com/api/v3"
RUN_TYPES = {"Run", "TrailRun"}
RACE_WORKOUT_TYPE = 1  # Strava's "Race" run type
# (label, min km, max km) for personal bests among races
PB_DISTANCES = [("5 km", 4.9, 5.3), ("10 km", 9.8, 10.5), ("Half marathon", 20.9, 21.6), ("Marathon", 41.9, 43.0)]


def request(url, data=None, token=None):
    headers = {"User-Agent": "portfolio-site-build"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = urllib.parse.urlencode(data).encode() if data else None
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=30) as r:
        return json.load(r)


def access_token():
    resp = request("https://www.strava.com/oauth/token", data={
        "client_id": os.environ["STRAVA_CLIENT_ID"],
        "client_secret": os.environ["STRAVA_CLIENT_SECRET"],
        "grant_type": "refresh_token",
        "refresh_token": os.environ["STRAVA_REFRESH_TOKEN"],
    })
    if resp.get("refresh_token") and resp["refresh_token"] != os.environ["STRAVA_REFRESH_TOKEN"]:
        print("fetch_strava: WARNING Strava issued a new refresh token; "
              "re-run scripts/strava_auth.py if later builds fail", file=sys.stderr)
    return resp["access_token"]


def all_activities(token):
    acts, page = [], 1
    while True:
        batch = request(f"{API}/athlete/activities?per_page=200&page={page}", token=token)
        if not batch:
            return acts
        acts += batch
        page += 1


def hms(seconds):
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def pace(seconds, km):
    return hms(seconds / km) + " /km" if km else ""


def run_entry(a, use_elapsed=False):
    km = a["distance"] / 1000
    t = a["elapsed_time"] if use_elapsed else a["moving_time"]
    return {
        "id": a["id"],
        "url": f"https://www.strava.com/activities/{a['id']}",
        "name": a["name"],
        "date": a["start_date_local"][:10],
        "distance_km": round(km, 2),
        "time": hms(t),
        "seconds": t,
        "pace": pace(t, km),
        "elevation_m": round(a.get("total_elevation_gain") or 0),
    }


def totals(runs):
    return {
        "count": len(runs),
        "distance_km": round(sum(a["distance"] for a in runs) / 1000),
        "hours": round(sum(a["moving_time"] for a in runs) / 3600),
        "elevation_m": round(sum(a.get("total_elevation_gain") or 0 for a in runs)),
    }


def summarize(acts, athlete):
    runs = [a for a in acts
            if (a.get("sport_type") or a.get("type")) in RUN_TYPES
            and a.get("visibility", "everyone") == "everyone" and not a.get("private")]
    runs.sort(key=lambda a: a["start_date_local"], reverse=True)
    this_year = str(datetime.now().year)

    by_year = defaultdict(list)
    for a in runs:
        by_year[a["start_date_local"][:4]].append(a)

    races = [run_entry(a, use_elapsed=True) for a in runs if a.get("workout_type") == RACE_WORKOUT_TYPE]
    pbs = []
    for label, lo, hi in PB_DISTANCES:
        cands = [r for r in races if lo <= r["distance_km"] <= hi]
        if cands:
            pbs.append({"distance": label, **min(cands, key=lambda r: r["seconds"])})

    return {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "athlete_url": f"https://www.strava.com/athletes/{athlete['id']}",
        "this_year": {"year": this_year, **totals(by_year.get(this_year, []))},
        "all_time": totals(runs),
        "years": [{"year": y, **totals(by_year[y])} for y in sorted(by_year, reverse=True)],
        "personal_bests": pbs,
        "races": races,
        "longest": run_entry(max(runs, key=lambda a: a["distance"])) if runs else None,
        "recent": [run_entry(a) for a in runs[:5]],
    }


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "data/running.json"
    missing = [v for v in ("STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REFRESH_TOKEN") if not os.environ.get(v)]
    if missing:
        print(f"fetch_strava: skipped, missing {', '.join(missing)}", file=sys.stderr)
        return 0
    try:
        token = access_token()
        athlete = request(f"{API}/athlete", token=token)
        data = summarize(all_activities(token), athlete)
    except Exception as e:  # never break the site build because of Strava
        print(f"fetch_strava: failed ({e}); Run page will show a fallback", file=sys.stderr)
        return 0
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"fetch_strava: {data['all_time']['count']} public runs, {len(data['races'])} races -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
