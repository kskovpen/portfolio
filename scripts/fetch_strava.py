#!/usr/bin/env python3
"""Fetch public Strava runs and write a summary JSON for the Run page.

Needs env vars STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN
(see scripts/strava_auth.py). Only activities with visibility "everyone" are used;
no maps or start locations are written.

Usage: python3 scripts/fetch_strava.py data/running.json
"""
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

API = "https://www.strava.com/api/v3"
RUN_TYPES = {"Run", "TrailRun"}
RACE_WORKOUT_TYPE = 1  # Strava's "Race" run type


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


def gear_summary(acts, token):
    """Shoes and other gear used on activities, with Strava's total distance per item."""
    used = defaultdict(list)
    for a in acts:
        if a.get("gear_id"):
            used[a["gear_id"]].append(a["start_date_local"][:10])
    gear = []
    for gid, dates in used.items():
        try:
            g = request(f"{API}/gear/{gid}", token=token)
        except Exception as e:
            print(f"fetch_strava: gear {gid} skipped ({e})", file=sys.stderr)
            continue
        gear.append({
            "name": g.get("name") or " ".join(filter(None, [g.get("brand_name"), g.get("model_name")])),
            "distance_km": round((g.get("distance") or 0) / 1000),
            "retired": bool(g.get("retired")),
            "activities": len(dates),
            "first_used": min(dates),
            "last_used": max(dates),
        })
    gear.sort(key=lambda g: g["distance_km"], reverse=True)
    return gear


def decode_polyline(encoded):
    """Google encoded polyline -> list of (lat, lon)."""
    coords, index, lat, lon = [], 0, 0, 0
    while index < len(encoded):
        for i in range(2):
            shift = result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if i == 0:
                lat += delta
            else:
                lon += delta
        coords.append((lat / 1e5, lon / 1e5))
    return coords


def route_path(encoded, size=100.0, pad=4.0):
    """Route outline as an SVG path in a size x size box (aspect preserved, north up)."""
    pts = decode_polyline(encoded or "")
    if len(pts) < 2:
        return ""
    k = math.cos(math.radians(sum(p[0] for p in pts) / len(pts)))
    xs = [p[1] * k for p in pts]
    ys = [-p[0] for p in pts]
    span = max(max(xs) - min(xs), max(ys) - min(ys)) or 1
    scale = (size - 2 * pad) / span
    ox = pad + ((size - 2 * pad) - (max(xs) - min(xs)) * scale) / 2
    oy = pad + ((size - 2 * pad) - (max(ys) - min(ys)) * scale) / 2
    out = [f"{ox + (x - min(xs)) * scale:.1f},{oy + (y - min(ys)) * scale:.1f}" for x, y in zip(xs, ys)]
    return "M" + "L".join(out)


def race_routes(runs, races_file="data/races.yaml", utmb_file="data/utmb.json"):
    """Route outlines only for races: Strava ids listed in races.yaml, and runs on UTMB race dates.
    Training runs (which start from home) never get a route."""
    ids = set()
    try:
        ids = {int(x) for x in re.findall(r"^\s*-?\s*strava:\s*(\d+)", open(races_file).read(), re.M)}
    except OSError:
        pass
    dates = set()
    try:
        dates = {r["date"] for r in json.load(open(utmb_file))["results"]}
    except (OSError, ValueError, KeyError):
        pass
    longest_on = {}
    for a in runs:
        d = a["start_date_local"][:10]
        if d in dates and a["distance"] > longest_on.get(d, (0, None))[0]:
            longest_on[d] = (a["distance"], a["id"])
    ids |= {i for _, i in longest_on.values()}
    return {str(a["id"]): route_path((a.get("map") or {}).get("summary_polyline"))
            for a in runs if a["id"] in ids}


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

    # Distance per month for the last 24 months (including empty months)
    now = datetime.now()
    months = []
    for i in range(23, -1, -1):
        y, m = divmod(now.year * 12 + now.month - 1 - i, 12)
        key = f"{y}-{m + 1:02d}"
        km = sum(a["distance"] for a in runs if a["start_date_local"][:7] == key) / 1000
        months.append({"month": key, "distance_km": round(km)})

    return {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "athlete_url": f"https://www.strava.com/athletes/{athlete['id']}",
        "this_year": {"year": this_year, **totals(by_year.get(this_year, []))},
        "all_time": {"since": min(by_year) if by_year else this_year, **totals(runs)},
        "years": [{"year": y, **totals(by_year[y])} for y in sorted(by_year)],
        "months": months,
        "races": races,
        # Every public run (compact), so data/races.yaml can refer to races by Strava id
        "routes": race_routes(runs),
        "runs": [{k: v for k, v in run_entry(a, use_elapsed=True).items() if k not in ("name", "pace")} for a in runs],
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
        acts = all_activities(token)
        data = summarize(acts, athlete)
        data["gear"] = gear_summary(acts, token)
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
