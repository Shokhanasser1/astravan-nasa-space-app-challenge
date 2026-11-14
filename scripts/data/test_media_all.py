"""Tests for media_all.py (which flare a week's Sun pictures show). Run: python -I scripts/data/test_media_all.py"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from media_all import class_rank, storm_flare  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def day(n, level, *flares):
    return {'day': n, 'level': level, 'flares': [{'cls': c, 'peak_utc': t} for c, t in flares]}


class Rank(unittest.TestCase):
    def test_letter_then_number(self):
        self.assertGreater(class_rank('X1.0'), class_rank('M9.8'))
        self.assertGreater(class_rank('M5.1'), class_rank('M5.0'))


class StormFlare(unittest.TestCase):
    def test_quiet_week_has_none(self):
        self.assertIsNone(storm_flare([day(i, 0) for i in range(1, 8)]))

    def test_strongest_on_the_peak_day_or_the_day_before(self):
        # The X9.3 on day 1 is the strongest of the week, but the level-4 storm (day 6) follows the X8.2 of day 5.
        days = [day(1, 2, ('X9.3', '12:02')), day(2, 3), day(3, 2), day(4, 1), day(5, 3, ('X8.2', '16:06')),
                day(6, 4), day(7, 3)]
        self.assertEqual(storm_flare(days), (5, 'X8.2', '16:06'))

    def test_calm_dose_week_takes_the_strongest_flare(self):
        days = [day(1, 0, ('M4.5', '16:37')), day(5, 0, ('X3.1', '21:41')), day(6, 0, ('X1.0', '17:08'))]
        self.assertEqual(storm_flare(days), (5, 'X3.1', '21:41'))

    def test_no_flare_near_the_peak_looks_earlier(self):
        days = [day(1, 0, ('M4.0', '19:46')), day(2, 0), day(3, 0), day(4, 0), day(5, 2), day(6, 1), day(7, 1)]
        self.assertEqual(storm_flare(days), (1, 'M4.0', '19:46'))

    def test_week_one_matches_the_bundled_media(self):
        # public/data/media/2021-10-25 was built from the X1.0 of 28 Oct 2021, 15:35 UTC (concept 3.0).
        weeks = json.loads((ROOT / 'src' / 'engine' / 'weeks.json').read_text(encoding='utf-8'))
        weeks = weeks.get('weeks', weeks) if isinstance(weeks, dict) else weeks
        week = next(w for w in weeks if w['id'] == '2021-10-25')
        self.assertEqual(storm_flare(week['days']), (4, 'X1.0', '15:35'))


if __name__ == '__main__':
    unittest.main()
