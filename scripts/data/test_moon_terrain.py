"""Tests for the terrain builder's maths (no network). Run: python -I -m unittest scripts/data/test_moon_terrain.py -v"""

import json
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import moon_terrain as mt  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


class Projection(unittest.TestCase):
    def test_pole_is_the_origin(self):
        x, y = mt.polar_xy(-90, 0)
        self.assertAlmostEqual(x, 0, places=6)
        self.assertAlmostEqual(y, 0, places=6)

    def test_site_distance_from_the_pole(self):
        # 0.55° of latitude from the pole on a 1737.4 km sphere is about 16.7 km
        x, y = mt.polar_xy(-89.45, 222.69)
        self.assertAlmostEqual(math.hypot(x, y), 16678, delta=10)
        self.assertLess(x, 0)
        self.assertLess(y, 0)

    def test_longitude_zero_is_plus_y(self):
        x, y = mt.polar_xy(-89, 0)
        self.assertAlmostEqual(x, 0, places=6)
        self.assertGreater(y, 0)


class SceneFrame(unittest.TestCase):
    def test_map_plus_y_points_to_earth_azimuth(self):
        for az in (0, 90, 212.96, 300):
            phi = mt.scene_rotation(az)
            # scene offset 1 km toward the azimuth must be map +y from the site
            a = math.radians(az)
            mx, my = mt.scene_to_map(1000 * math.cos(a), 1000 * math.sin(a), phi, (0.0, 0.0))
            self.assertAlmostEqual(mx, 0, delta=1e-6)
            self.assertAlmostEqual(my, 1000, delta=1e-6)

    def test_turn_keeps_lengths(self):
        phi = mt.scene_rotation(212.96)
        mx, my = mt.scene_to_map(300, -400, phi, (0.0, 0.0))
        self.assertAlmostEqual(math.hypot(mx, my), 500, delta=1e-6)

    def test_curvature_drop(self):
        # the Moon's surface falls 0.29 m below a flat plane 1 km away, 460 m at 40 km
        self.assertAlmostEqual(mt.curvature_drop(1000), 0.2878, places=3)
        self.assertAlmostEqual(mt.curvature_drop(40000), 460.5, delta=0.5)


class BuiltFile(unittest.TestCase):
    def test_site_json_shape(self):
        path = ROOT / "public" / "data" / "terrain" / "site.json"
        if not path.exists():
            self.skipTest("site.json not built")
        d = json.loads(path.read_text(encoding="utf-8"))
        n = d["near"]["n"]
        self.assertEqual(len(d["near"]["h"]), n * n)
        self.assertEqual(len(d["far"]["h"]), len(d["far"]["radii_m"]) * d["far"]["az_n"])
        centre = d["near"]["h"][(n // 2) * n + n // 2]
        self.assertLess(abs(centre), 50, "the site is the zero of the heights (cm)")
        self.assertIn("pgda.gsfc.nasa.gov", d["source"]["near"])


if __name__ == "__main__":
    unittest.main()
