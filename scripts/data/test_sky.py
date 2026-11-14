"""Tests for sky.py. Run: python -I scripts/data/test_sky.py"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sky import SITE_LON, parse_rows, week_days  # noqa: E402

# JPL Horizons, observer on the Moon at the site, 2021-10-25..31 12:00 UTC (fetched 2026-11-15).
EARTH = """ Date__(UT)__HR:MN     Azi____(a-app)___Elev      Illu%
$$SOE
 2021-Oct-25 12:00  i  135.011062   2.068650   20.12489
 2021-Oct-26 12:00  i  133.643876   3.298886   28.19274
 2021-Oct-27 12:00  i  132.406974   4.370753   37.12568
 2021-Oct-28 12:00  i  131.382106   5.236547   46.68420
 2021-Oct-29 12:00 *i  130.649391   5.848448   56.59470
 2021-Oct-30 12:00 *i  130.280488   6.159133   66.52811
 2021-Oct-31 12:00 *i  130.329919   6.124863   76.07839
$$EOE"""
SUN = """$$SOE
 2021-Oct-25 12:00  i   81.894494  -0.716892  100.00000
 2021-Oct-26 12:00  i   69.729581  -0.579653  100.00000
 2021-Oct-27 12:00  i   57.560095  -0.450941  100.00000
 2021-Oct-28 12:00  i   45.385467  -0.335403  100.00000
 2021-Oct-29 12:00 *i   33.205313  -0.237044  100.00000
 2021-Oct-30 12:00 *i   21.019468  -0.159057  100.00000
 2021-Oct-31 12:00 *i    8.828030  -0.103688  100.00000
$$EOE"""


class Parse(unittest.TestCase):
    def test_rows_between_markers(self):
        rows = parse_rows(EARTH)
        self.assertEqual(len(rows), 7)
        self.assertEqual(rows[0], (135.011062, 2.06865, 20.12489))

    def test_short_answer_is_an_error(self):
        with self.assertRaises(RuntimeError):
            parse_rows('$$SOE\n 2021-Oct-25 12:00  i  1.0  2.0  3.0\n$$EOE')


class Week(unittest.TestCase):
    def test_reproduces_the_checked_week(self):
        # sky.json week 2021-10-25 as checked against Horizons on 14 Nov: Earth elevation and lit fraction
        # exactly; Sun azimuth (concept 3.0 table) within 1° once rounded to whole degrees (0.6° before).
        concept_az = [304, 292, 280, 268, 256, 244, 232]
        days = week_days(parse_rows(EARTH), parse_rows(SUN))
        self.assertEqual([d['earth_el_deg'] for d in days], [2.1, 3.3, 4.4, 5.2, 5.8, 6.2, 6.1])
        self.assertEqual([d['earth_phase'] for d in days], [0.2, 0.28, 0.37, 0.47, 0.57, 0.67, 0.76])
        for d, az in zip(days, concept_az):
            self.assertLessEqual(abs(d['sun_az_deg'] - az), 1)
        self.assertEqual(days[0]['sun_el_true_deg'], -0.7)
        self.assertEqual([d['day'] for d in days], list(range(1, 8)))

    def test_azimuth_wraps_at_360(self):
        sun = [(150.0, 0.5, 100.0)] * 7
        days = week_days(parse_rows(EARTH), sun)
        self.assertEqual(days[0]['sun_az_deg'], round((150.0 + SITE_LON) % 360))


if __name__ == '__main__':
    unittest.main()
