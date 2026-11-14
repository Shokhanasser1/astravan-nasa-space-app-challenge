"""Tests for the pure helpers of fetch_media.py. Run: python -I -m unittest scripts/data/test_fetch_media.py -v"""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_media import (  # noqa: E402
    gibs_layer,
    gibs_url,
    looks_like_image,
    parse_sdo_listing,
    pick_latest_before,
    pick_nearest,
)

UTC = timezone.utc
LISTING = """
<a href="20211028_141532_1024_0131.jpg">x</a> <a href="20211028_153522_1024_0131.jpg">x</a>
<a href="20211028_154508_1024_0131.jpg">x</a> <a href="20211028_153522_1024_0193.jpg">decoy channel</a>
<a href="20211028_153522_512_0131.jpg">decoy size</a> <a href="20211028_153522_1024_0131.jpg">duplicate</a>
"""


def t(h, m, s=0):
    return datetime(2021, 10, 28, h, m, s, tzinfo=UTC)


class ParseListing(unittest.TestCase):
    def test_keeps_only_channel_and_size_sorted_unique(self):
        self.assertEqual(parse_sdo_listing(LISTING, '2021-10-28'), [t(14, 15, 32), t(15, 35, 22), t(15, 45, 8)])

    def test_ignores_other_days(self):
        self.assertEqual(parse_sdo_listing(LISTING, '2021-10-29'), [])


class PickFrames(unittest.TestCase):
    frames = [t(14, 15, 32), t(15, 35, 22), t(15, 45, 8)]

    def test_nearest_within_window(self):
        self.assertEqual(pick_nearest(self.frames, t(15, 35), timedelta(minutes=15)), t(15, 35, 22))

    def test_nearest_none_outside_window(self):
        self.assertIsNone(pick_nearest(self.frames, t(17, 0), timedelta(minutes=15)))

    def test_nearest_is_deterministic_on_ties(self):
        tie = [t(15, 30), t(15, 40)]
        self.assertEqual(pick_nearest(tie, t(15, 35), timedelta(minutes=15)), t(15, 30))

    def test_latest_before_limit(self):
        self.assertEqual(pick_latest_before(self.frames, t(14, 17)), t(14, 15, 32))

    def test_latest_before_none(self):
        self.assertIsNone(pick_latest_before(self.frames, t(14, 0)))


class Gibs(unittest.TestCase):
    def test_layer_before_2016_is_modis(self):
        self.assertTrue(gibs_layer('2015-12-31').startswith('MODIS_Terra'))

    def test_layer_from_2016_is_viirs(self):
        self.assertTrue(gibs_layer('2021-10-28').startswith('VIIRS_SNPP'))

    def test_url_has_date_size_and_global_bbox(self):
        url = gibs_url('2021-10-28')
        for part in ('TIME=2021-10-28', 'WIDTH=2048', 'HEIGHT=1024', 'BBOX=-180,-90,180,90', 'FORMAT=image/jpeg'):
            self.assertIn(part, url)


class ImageCheck(unittest.TestCase):
    def test_jpeg_and_png_accepted(self):
        self.assertTrue(looks_like_image(b'\xff\xd8\xff\xe0rest'))
        self.assertTrue(looks_like_image(b'\x89PNG\r\n\x1a\nrest'))

    def test_error_pages_rejected(self):
        self.assertFalse(looks_like_image(b'<?xml version="1.0"?><ServiceException/>'))
        self.assertFalse(looks_like_image(b'<!DOCTYPE html>'))
        self.assertFalse(looks_like_image(b''))


if __name__ == '__main__':
    unittest.main()
