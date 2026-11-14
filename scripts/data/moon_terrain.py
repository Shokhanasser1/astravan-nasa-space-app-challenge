"""Real terrain around the base (3D demo and game): public/data/terrain/site.json.

Heights come from NASA LRO LOLA digital elevation models on the NASA GSFC Planetary Geodesy Data Archive:
  near  (±160 m, 5 m grid)   Site01 "Connecting ridge" 5 m/px DEM (Barker et al. 2021)
  far   (120 m … 60 km)     80-90°S 20 m/px DEM and its overviews (Barker et al. 2023)
The site is read from src/engine/sky.json (the same point the Sun and Earth positions are computed for).
Only the tiles that are needed are downloaded (HTTP range requests, see lola_tiff.py).

Scene frame (Three.js, Y up, azimuth 0 = +X, 90 = +Z, as public/oy/sky/sky.json): the map's +y axis (the
direction of lunar longitude 0, where Earth hangs in the sky of the south pole) is turned to the azimuth of Earth
in the demo's sky (oy_sky.earth.azimuth_deg), so the real skyline sits under the Earth of the panorama.
Heights are metres above the site, minus the drop of the Moon's curved surface (r² / 2R).

    python -I scripts/data/moon_terrain.py            # writes public/data/terrain/site.json
    python -I scripts/data/moon_terrain.py --preview out.png
"""

import datetime
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from lola_tiff import RemoteTiff  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
R_MOON = 1737400.0  # m, the sphere of both DEMs (PGDA)
SITE01 = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif"
POLE20 = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
NEAR_HALF, NEAR_STEP = 160.0, 5.0
RING_MIN, RING_MAX, RINGS, AZ_N = 120.0, 60000.0, 44, 256


def polar_xy(lat, lon):
    """South polar stereographic, true scale at the pole (PGDA products): metres."""
    rho = 2 * R_MOON * math.tan(math.radians(45 + lat / 2))
    return rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))


def scene_rotation(earth_az_deg):
    """Angle phi with scene X = x cos phi - y sin phi, -Z = x sin phi + y cos phi, map +y -> Earth's azimuth."""
    a = math.radians(earth_az_deg)
    return math.atan2(-math.cos(a), -math.sin(a))


def scene_to_map(X, Z, phi, site):
    """Scene offset (X, Z) in metres -> map x, y (inverse of the rotation above)."""
    mz = -Z
    x = X * math.cos(phi) + mz * math.sin(phi)
    y = -X * math.sin(phi) + mz * math.cos(phi)
    return site[0] + x, site[1] + y


def curvature_drop(r):
    return r * r / (2 * R_MOON)


class Grid:
    """A downloaded DEM window with bilinear lookup in map metres."""

    def __init__(self, tif, cx, cy, half):
        sx = tif.scale[0]
        x0, y0 = tif.tie[3], tif.tie[4]
        self.px = sx
        c0 = int(math.floor((cx - half - x0) / sx))
        r0 = int(math.floor((y0 - (cy + half)) / sx))
        n = int(math.ceil(2 * half / sx)) + 2
        c0, r0 = max(c0, 0), max(r0, 0)
        w, h = min(n, tif.width - c0), min(n, tif.height - r0)
        self.z = tif.window(c0, r0, w, h)
        # pixel centres (PGDA rasters are pixel-registered)
        self.x0 = x0 + (c0 + 0.5) * sx
        self.y0 = y0 - (r0 + 0.5) * sx

    def at(self, x, y):
        fx = (x - self.x0) / self.px
        fy = (self.y0 - y) / self.px
        i, j = int(math.floor(fy)), int(math.floor(fx))
        if i < 0 or j < 0 or i + 1 >= self.z.shape[0] or j + 1 >= self.z.shape[1]:
            return None
        ty, tx = fy - i, fx - j
        q = self.z[i:i + 2, j:j + 2]
        v = (q[0, 0] * (1 - tx) + q[0, 1] * tx) * (1 - ty) + (q[1, 0] * (1 - tx) + q[1, 1] * tx) * ty
        return None if np.isnan(v) else float(v)


def ring_radii():
    k = (RING_MAX / RING_MIN) ** (1 / (RINGS - 1))
    return [RING_MIN * k ** i for i in range(RINGS)]


def build(sky_path, demo_sky_path):
    sky = json.loads(Path(sky_path).read_text(encoding="utf-8"))
    demo = json.loads(Path(demo_sky_path).read_text(encoding="utf-8"))
    lat, lon = sky["site"]["lat"], sky["site"]["lon"]
    earth_az = demo["skies"]["oy_sky"]["earth"]["azimuth_deg"]
    phi = scene_rotation(earth_az)
    site = polar_xy(lat, lon)

    print("near: Site01 5 m/px …", flush=True)
    near_tif = RemoteTiff(SITE01)
    near = Grid(near_tif, site[0], site[1], NEAR_HALF * 1.5 + 700)
    h0 = near.at(*site)

    print("far: 80-90°S 20 m/px and overviews …", flush=True)
    levels = []  # (grid, half-size): finest first
    for lv, half in [(0, 2500), (1, 6000), (2, 14000), (3, 32000), (4, 70000)]:
        levels.append((Grid(RemoteTiff(POLE20, lv), site[0], site[1], half), half))
    # offset between the two DEMs at the site (both "ADJ", should be small)
    far_h0 = levels[0][0].at(*site)
    offset = h0 - far_h0

    n = int(round(2 * NEAR_HALF / NEAR_STEP)) + 1
    near_h = []
    for i in range(n):
        Z = -NEAR_HALF + i * NEAR_STEP
        for j in range(n):
            X = -NEAR_HALF + j * NEAR_STEP
            mx, my = scene_to_map(X, Z, phi, site)
            v = near.at(mx, my)
            r = math.hypot(X, Z)
            near_h.append(round(((v if v is not None else h0) - h0 - curvature_drop(r)) * 100))

    radii = ring_radii()
    far_h = []
    for r in radii:
        spacing = max(2 * math.pi * r / AZ_N, r * 0.17)
        for a in range(AZ_N):
            th = 2 * math.pi * a / AZ_N
            X, Z = r * math.cos(th), r * math.sin(th)
            mx, my = scene_to_map(X, Z, phi, site)
            v = None
            if r < 900:
                v = near.at(mx, my)
            if v is None:
                for g, half in levels:
                    if r < half * 0.95 and g.px >= spacing / 4:
                        w = g.at(mx, my)
                        if w is not None:
                            v = w + offset
                            break
            if v is None:
                for g, half in reversed(levels):
                    w = g.at(mx, my)
                    if w is not None:
                        v = w + offset
                        break
            far_h.append(round(((v if v is not None else h0) - h0 - curvature_drop(r)) * 10))

    today = datetime.date.today().isoformat()
    return {
        "about": "Real terrain around the base (Shackleton–de Gerlache ridge) for the 3D scenes. Label: measured "
                 "(LRO LOLA heights) + computed (curvature drop r²/2R, the frame turn). Made by "
                 "scripts/data/moon_terrain.py.",
        "source": {
            "near": SITE01, "far": POLE20, "downloaded": today,
            "credit": "Heights: NASA LRO LOLA, NASA GSFC Planetary Geodesy Data Archive (Barker et al. 2021, 2023).",
        },
        "site": {"name": sky["site"]["name"], "lat": lat, "lon": lon, "map_x": round(site[0], 1),
                 "map_y": round(site[1], 1), "height_m": round(h0, 1), "dem_offset_m": round(offset, 2)},
        "frame": {"earth_az_deg": earth_az, "rotation_deg": round(math.degrees(phi), 3),
                  "note": "map +y (lunar longitude 0, toward Earth) is turned to Earth's azimuth in oy_sky"},
        "near": {"half_m": NEAR_HALF, "step_m": NEAR_STEP, "n": n, "unit": "cm", "h": near_h},
        "far": {"radii_m": [round(r, 1) for r in radii], "az_n": AZ_N, "unit": "dm", "h": far_h},
    }


def preview(data, path):
    from PIL import Image

    n = data["near"]["n"]
    a = np.array(data["near"]["h"], dtype=float).reshape(n, n) / 100
    gy, gx = np.gradient(a, data["near"]["step_m"])
    shade = np.clip(0.5 + (-gx * 0.6 - gy * 0.4) * 3, 0, 1)
    Image.fromarray((shade * 255).astype(np.uint8)).resize((n * 6, n * 6)).save(path)
    radii, az = data["far"]["radii_m"], data["far"]["az_n"]
    f = np.array(data["far"]["h"], dtype=float).reshape(len(radii), az) / 10
    ang = np.degrees(np.arctan2(f, np.array(radii)[:, None]))
    sky = ang.max(axis=0)
    print("horizon elevation: min %.2f° max %.2f° mean %.2f°" % (sky.min(), sky.max(), sky.mean()))
    print("near relief: min %.1f m max %.1f m" % (a.min(), a.max()))


if __name__ == "__main__":
    out = ROOT / "public" / "data" / "terrain" / "site.json"
    data = build(ROOT / "src" / "engine" / "sky.json", ROOT / "public" / "oy" / "sky" / "sky.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB), site height {data['site']['height_m']} m, "
          f"DEM offset {data['site']['dem_offset_m']} m")
    if "--preview" in sys.argv:
        preview(data, sys.argv[sys.argv.index("--preview") + 1])
