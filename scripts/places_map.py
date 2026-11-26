#!/usr/bin/env python3
"""Outline map of Europe for the "Places" map (partials/places-map.html).

Reads Natural Earth country shapes (public domain) in TopoJSON form, e.g. from the
world-atlas package: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
and writes data/map_europe.json with SVG path data already projected to the map window.
The template projects each place with the same formula (see PROJ below), so the two agree.

    python3 scripts/places_map.py countries-50m.json data/map_europe.json europe
    python3 scripts/places_map.py countries-110m.json data/map_world.json world
Only needs re-running if a window or the detail level changes.
"""
import json, math, sys

# Map window and projection (equirectangular, scaled for latitude LAT0). Keep in sync with
# themes/basic/layouts/partials/places-map.html.
WINDOWS = {  # lon_min, lon_max, lat_min, lat_max, lat0 (latitude kept true to scale), SVG units per degree of latitude
    "europe": (-10.0, 24.0, 40.0, 56.5, 48.0, 34.0),
    "world": (-170.0, 190.0, -56.0, 78.0, 30.0, 4.0),
}
MIN_STEP = 1.2                                  # drop points closer than this (SVG units)


def setup(name):
    global LON_MIN, LON_MAX, LAT_MIN, LAT_MAX, SCALE, KX, W, H, WORLD
    WORLD = name == "world"
    LON_MIN, LON_MAX, LAT_MIN, LAT_MAX, lat0, SCALE = WINDOWS[name]
    KX = SCALE * math.cos(math.radians(lat0))
    W = round((LON_MAX - LON_MIN) * KX)
    H = round((LAT_MAX - LAT_MIN) * SCALE)


def proj(lon, lat):
    return (lon - LON_MIN) * KX, (LAT_MAX - lat) * SCALE


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def ring(arcs, idx):
    pts = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def near_window(pts, pad=6):
    if WORLD:                                      # everything except Antarctica
        return max(p[1] for p in pts) > LAT_MIN
    lons = [p[0] for p in pts]; lats = [p[1] for p in pts]
    return not (max(lons) < LON_MIN - pad or min(lons) > LON_MAX + pad or max(lats) < LAT_MIN - pad or min(lats) > LAT_MAX + pad)


def path(pts):
    d, last = [], None
    if WORLD:                                      # rings crossing the date line, or lying west of the window: shift east
        lons = [p[0] for p in pts]
        if max(lons) - min(lons) > 180:
            pts = [(lon + 360 if lon < 0 else lon, lat) for lon, lat in pts]
        elif max(lons) < LON_MIN:
            pts = [(lon + 360, lat) for lon, lat in pts]
    for lon, lat in pts:
        if WORLD:
            pass
        else:                                      # clamp to a padded window: same look, far smaller file
            lon = min(max(lon, LON_MIN - 2), LON_MAX + 2); lat = min(max(lat, LAT_MIN - 2), LAT_MAX + 2)
        x, y = proj(lon, lat)
        if last and math.hypot(x - last[0], y - last[1]) < MIN_STEP:
            continue
        d.append(f"{x:.1f} {y:.1f}"); last = (x, y)
    return ("M" + " L".join(d) + "Z") if len(d) > 2 else ""


def main(src, out, name="europe"):
    setup(name)
    topo = json.load(open(src))
    arcs = decode_arcs(topo)
    shapes = []
    for g in topo["objects"]["countries"]["geometries"]:
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]] if g["type"] == "Polygon" else []
        d = ""
        for poly in polys:
            outer = ring(arcs, poly[0])
            if near_window(outer):
                d += path(outer)
        if d:
            shapes.append(d)
    json.dump({"w": W, "h": H, "lon_min": LON_MIN, "lat_max": LAT_MAX, "kx": round(KX, 6), "scale": SCALE,
               "source": "Natural Earth (public domain), via world-atlas 2.0.2", "countries": shapes},
              open(out, "w"), separators=(",", ":"))
    print(f"{len(shapes)} countries, {W}x{H} -> {out}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
