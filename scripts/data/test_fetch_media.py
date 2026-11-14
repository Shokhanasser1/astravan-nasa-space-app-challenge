"""Tests for the pure helpers of fetch_media.py. Run: python -I -m unittest scripts/data/test_fetch_media.py -v"""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import io  # noqa: E402
import json  # noqa: E402
import tempfile  # noqa: E402

from PIL import Image  # noqa: E402

from fetch_media import (  # noqa: E402
    build_week,
    gibs_layer,
    gibs_url,
    looks_like_image,
    parse_sdo_listing,
    pick_latest_before,
    pick_nearest,
    to_webp,
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


def jpeg(w, h):
    buf = io.BytesIO()
    Image.new('RGB', (w, h), (200, 120, 40)).save(buf, 'JPEG')
    return buf.getvalue()


class ToWebp(unittest.TestCase):
    def test_resizes_to_width_and_writes_webp(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / 'earth.webp'
            to_webp(jpeg(2048, 1024), out, width=1024)
            with Image.open(out) as im:
                self.assertEqual((im.format, im.size), ('WEBP', (1024, 512)))


class SizeBudget(unittest.TestCase):
    def test_lowers_quality_until_under_budget(self):
        import random
        rnd = random.Random(1)
        im = Image.frombytes('RGB', (1024, 1024), bytes(rnd.getrandbits(8) for _ in range(1024 * 1024 * 3)))
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=95)
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / 'noisy.webp'
            to_webp(buf.getvalue(), out, width=1024, max_bytes=150_000)
            self.assertLessEqual(out.stat().st_size, 150_000)


class BuildWeek(unittest.TestCase):
    listing = '20211028_141532_1024_0131.jpg 20211028_153522_1024_0131.jpg'

    def fake_fetch(self, bad=None):
        def fetch(url):
            if url.endswith('/2021/10/28/'):
                return self.listing.encode()
            if bad and bad in url:
                return b'<?xml version="1.0"?><ServiceException/>'
            return jpeg(64, 32) if 'gibs' in url else jpeg(64, 64)
        return fetch

    def run_week(self, d, fetch):
        return build_week('2021-10-25', '2021-10-28T15:17Z', '2021-10-28T15:35Z',
                          out_dir=Path(d) / 'out', raw_dir=Path(d) / 'raw', fetch=fetch)

    def test_writes_nine_images_and_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            manifest = self.run_week(d, self.fake_fetch())
            out = Path(d) / 'out'
            self.assertEqual(sorted(p.name for p in out.glob('*.webp'))[:2], ['earth-2021-10-25.webp', 'earth-2021-10-26.webp'])
            self.assertEqual(len(list(out.glob('*.webp'))), 9)
            self.assertTrue((out / 'sdo-peak.webp').exists() and (out / 'sdo-before.webp').exists())
            saved = json.loads((out / 'manifest.json').read_text(encoding='utf-8'))
            self.assertEqual(saved, manifest)
            peak = next(f for f in manifest['files'] if f['file'] == 'sdo-peak.webp')
            self.assertEqual(peak['original'], '20211028_153522_1024_0131.jpg')
            before = next(f for f in manifest['files'] if f['file'] == 'sdo-before.webp')
            self.assertEqual(before['original'], '20211028_141532_1024_0131.jpg')
            self.assertTrue(all(f['label'] == 'measured' for f in manifest['files']))
            self.assertIn('Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.', manifest['credits'].values())

    def test_sdo_images_have_the_date_strip_cropped(self):
        # SDO browse images print "SDO/AIA 131 2021-10-28 15:35:22 UT" at the bottom; the date must not
        # appear during play (final version: only UTC clock times). The UI writes the caption on the truth screen.
        with tempfile.TemporaryDirectory() as d:
            self.run_week(d, self.fake_fetch())
            for name in ('sdo-peak.webp', 'sdo-before.webp'):
                with Image.open(Path(d) / 'out' / name) as im:
                    self.assertLess(im.height, im.width * 0.95, name)

    def test_error_body_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(RuntimeError):
                self.run_week(d, self.fake_fetch(bad='TIME=2021-10-29'))
            self.assertFalse((Path(d) / 'out').exists())

    def test_no_frame_in_window_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            self.listing = '20211028_120000_1024_0131.jpg'
            with self.assertRaises(RuntimeError):
                self.run_week(d, self.fake_fetch())
            self.assertFalse((Path(d) / 'out').exists())


if __name__ == '__main__':
    unittest.main()
