"""Real Sun (SDO) and Earth (GIBS) media for a game week. BUILD TIME ONLY — the game never calls NASA.

Spec: docs/specs/2026-11-14-week1-media.md · Plan: docs/plans/2026-11-14-week1-media.md
Usage: python -I scripts/data/fetch_media.py 2021-10-25 --flare-begin 2021-10-28T15:17Z --flare-peak 2021-10-28T15:35Z
       python -I scripts/data/fetch_media.py 2018-08-06 --quiet          (a week without flares)
All 14 weeks: python -I scripts/data/media_all.py
"""
import argparse
import io
import json
import re
import sys
import time
import urllib.request
from datetime import date as Date
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageStat

UTC = timezone.utc
SDO_BROWSE = 'https://sdo.gsfc.nasa.gov/assets/img/browse'
GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
HELIOVIEWER = 'https://api.helioviewer.org/v2'
AIA131_SOURCE = 9  # Helioviewer source id of SDO/AIA 131
SDO_BROWSE_FROM = Date(2016, 1, 1)  # sdo.gsfc.nasa.gov/assets/img/browse/ lists 2016 onward (checked 2026-11-15)


def parse_sdo_listing(html: str, day: str, channel: str = '0131', size: int = 1024) -> list[datetime]:
    """UTC times of SDO browse frames for one day, channel and size; sorted and unique."""
    ymd = day.replace('-', '')
    pattern = re.compile(rf'({ymd})_(\d{{6}})_{size}_{channel}\.jpg')
    times = {
        datetime.strptime(d + hms, '%Y%m%d%H%M%S').replace(tzinfo=UTC) for d, hms in pattern.findall(html)
    }
    return sorted(times)


def pick_nearest(frames: list[datetime], target: datetime, window: timedelta) -> datetime | None:
    """Frame closest to target within the window; ties go to the earlier frame (deterministic)."""
    inside = [f for f in frames if abs(f - target) <= window]
    return min(inside, key=lambda f: (abs(f - target), f)) if inside else None


def pick_latest_before(frames: list[datetime], limit: datetime) -> datetime | None:
    """Latest frame at or before the limit."""
    before = [f for f in frames if f <= limit]
    return max(before) if before else None


def gibs_layer(date: str) -> str:
    """VIIRS true colour from 2016 (fewer gaps), MODIS Terra before."""
    return 'VIIRS_SNPP_CorrectedReflectance_TrueColor' if date >= '2016-01-01' else 'MODIS_Terra_CorrectedReflectance_TrueColor'


def gibs_fill_layer(date: str) -> str | None:
    """Before 2016 MODIS Terra leaves black gaps between orbits; MODIS Aqua flies 3 hours later and fills most of
    them (VIIRS has no 2012-2015 data in GIBS: checked 2026-11-15, the image comes back black)."""
    return 'MODIS_Aqua_CorrectedReflectance_TrueColor' if gibs_layer(date).startswith('MODIS') else None


def gibs_url(date: str, width: int = 2048, height: int = 1024, layer: str | None = None) -> str:
    """WMS GetMap for the whole Earth on one day (equirectangular, EPSG:4326)."""
    return (
        f'{GIBS_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={layer or gibs_layer(date)}'
        f'&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH={width}&HEIGHT={height}&FORMAT=image/jpeg&TIME={date}'
    )


def fill_gaps(base: bytes, fill: bytes) -> bytes:
    """PNG of `base` whose black (no-data) pixels are taken from `fill`; night stays black in both."""
    with Image.open(io.BytesIO(base)) as b, Image.open(io.BytesIO(fill)) as f:
        b, f = b.convert('RGB'), f.convert('RGB').resize(b.size)
        gaps = b.convert('L').point(lambda v: 255 if v < 6 else 0)
        buf = io.BytesIO()
        Image.composite(f, b, gaps).save(buf, 'PNG')
        return buf.getvalue()


def looks_like_image(data: bytes) -> bool:
    """True for JPEG or PNG bytes; error pages (XML/HTML) and empty bodies are rejected."""
    return data.startswith(b'\xff\xd8\xff') or data.startswith(b'\x89PNG\r\n\x1a\n')


SDO_CREDIT = 'Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.'
GIBS_CREDIT = 'NASA EOSDIS GIBS / Worldview'
HELIOVIEWER_CREDIT = SDO_CREDIT + ' Image rendered by Helioviewer.org.'
CREDITS = {'sdo': SDO_CREDIT, 'helioviewer': HELIOVIEWER_CREDIT, 'gibs': GIBS_CREDIT}
ROOT = Path(__file__).resolve().parents[2]
# Phone budget (spec acceptance 1): week ≤ 1 MB = 7 Earth × 100 KB + 2 SDO × 150 KB.
EARTH_MAX_BYTES = 100_000
SDO_MAX_BYTES = 150_000
# SDO browse frames print 'SDO/AIA 131 <date> <time> UT' in the bottom strip; the date must not show during play.
SDO_DATE_STRIP = 0.08


def fetch(url: str) -> bytes:
    """GET with 3 tries (2 s, 4 s backoff); raises RuntimeError naming the URL."""
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as res:
                return res.read()
        except OSError as e:  # URLError, HTTPError, timeouts
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f'download failed after 3 tries: {url} ({last})')


def to_webp(data: bytes, out: Path, width: int, quality: int = 80, max_bytes: int | None = None,
            crop_bottom: float = 0.0) -> None:
    """Optionally cut `crop_bottom` (fraction of the height) off the bottom, resize to `width` keeping the aspect
    ratio and save as WebP. With `max_bytes`, lower the quality in steps of 5 (down to 40), then the width by
    15 %, until the file fits the budget."""
    with Image.open(io.BytesIO(data)) as src:
        src = src.convert('RGB')
        if crop_bottom:
            src = src.crop((0, 0, src.width, round(src.height * (1 - crop_bottom))))
        w, q = width, quality
        while True:
            im = src if src.width == w else src.resize((w, round(src.height * w / src.width)), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, 'WEBP', quality=q, method=6)
            if max_bytes is None or buf.tell() <= max_bytes or w <= 256:
                break
            if q > 40:
                q -= 5
            else:
                w, q = round(w * 0.85), quality
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(buf.getvalue())


def _utc(s: str) -> datetime:
    return datetime.strptime(s, '%Y-%m-%dT%H:%MZ').replace(tzinfo=UTC)


def sdo_url(frame: datetime) -> str:
    return f'{SDO_BROWSE}/{frame:%Y/%m/%d}/{frame:%Y%m%d_%H%M%S}_1024_0131.jpg'


def is_blinded(data: bytes) -> bool:
    """True when the sky in both top corners is grey, not black: AIA's short exposures during a big flare,
    stretched for the browse image, wash the whole frame out (2017-09-10 15:57 and 16:13 UTC: corners 39 and 65
    of 255). A slightly noisy sky is fine (2021-10-28 15:35, the X1.0 peak: 12)."""
    with Image.open(io.BytesIO(data)) as im:
        g = im.convert('L')
        w, h = g.size
        k = max(1, w // 10)
        return min(ImageStat.Stat(g.crop(box)).mean[0] for box in ((0, 0, k, k), (w - k, 0, w, k))) > 25


def pick_clean_near(frames: list[datetime], target: datetime, fetch, window: timedelta,
                    reach: timedelta = timedelta(minutes=30)) -> datetime | None:
    """Nearest frame within `reach` that is not blinded; if all are, the nearest within `window`."""
    for f in sorted((f for f in frames if abs(f - target) <= reach), key=lambda f: (abs(f - target), f)):
        if not is_blinded(fetch(sdo_url(f))):
            return f
    return pick_nearest(frames, target, window)


def helioviewer_frame(target: datetime, fetch=fetch) -> datetime:
    """UTC time of the AIA 131 image nearest the target, from Helioviewer."""
    url = f'{HELIOVIEWER}/getClosestImage/?date={target:%Y-%m-%dT%H:%M:%S}Z&sourceId={AIA131_SOURCE}'
    data = json.loads(fetch(url).decode('utf-8'))
    return datetime.strptime(data['date'], '%Y-%m-%d %H:%M:%S').replace(tzinfo=UTC)


def helioviewer_url(frame: datetime) -> str:
    """The full Sun in AIA 131 at that time, 1024 px, framed like the SDO browse images (2.4 arcsec per pixel)."""
    return (f'{HELIOVIEWER}/takeScreenshot/?date={frame:%Y-%m-%dT%H:%M:%S}Z&imageScale=2.4'
            f'&layers=[SDO,AIA,AIA,131,1,100]&x0=0&y0=0&width=1024&height=1024&display=true&watermark=false')


def _sdo_frames(fetch, *days: datetime) -> list[datetime]:
    """Frames listed in the SDO browse folders of the given days (each folder read once)."""
    frames = []
    for d in sorted({x.date() for x in days}):
        listing_url = f'{SDO_BROWSE}/{d:%Y/%m/%d}/'
        frames += parse_sdo_listing(fetch(listing_url).decode('utf-8', 'replace'), d.isoformat())
    return sorted(frames)


def build_week(week: str, flare_begin: str | None, flare_peak: str | None, out_dir: Path, raw_dir: Path,
               fetch=fetch) -> dict:
    """Download, check and convert all media for a week. Nothing is written to out_dir unless every
    source returned a real image and every frame was found (spec acceptance 3).
    A week with a flare gets sdo-before (the last frame an hour before the flare begins) + sdo-peak; a quiet week
    (no flare, both None) gets one sdo-day: the Sun nearest 12:00 UTC on day 4, within 3 hours, and
    `flare: null` in the manifest. Before 2016 the SDO browse archive is empty, so the same AIA 131 data comes from
    Helioviewer (credit 'helioviewer')."""
    start = Date.fromisoformat(week)
    if flare_peak is None:
        target = datetime(start.year, start.month, start.day, 12, tzinfo=UTC) + timedelta(days=3)
        wanted = {'sdo-day': (target, timedelta(hours=3))}
    else:
        begin, target = _utc(flare_begin), _utc(flare_peak)
        wanted = {'sdo-peak': (target, timedelta(minutes=15)), 'sdo-before': (begin - timedelta(minutes=60), None)}

    jobs = []  # (file name, source url, original name, width, credit, max bytes)
    if target.date() < SDO_BROWSE_FROM:
        for name, (when, window) in wanted.items():
            frame = helioviewer_frame(when, fetch)
            if abs(frame - when) > (window or timedelta(minutes=15)):
                raise RuntimeError(f'{name}: Helioviewer has no AIA 131 frame near {when:%Y-%m-%d %H:%M} UTC')
            jobs.append((f'{name}.webp', helioviewer_url(frame), f'helioviewer_AIA131_{frame:%Y%m%d_%H%M%S}.png',
                         1024, 'helioviewer', SDO_MAX_BYTES))
    else:
        frames = _sdo_frames(fetch, *(when for when, _ in wanted.values()))
        for name, (when, window) in wanted.items():
            if name == 'sdo-peak':
                frame = pick_clean_near(frames, when, fetch, window)
            else:
                frame = pick_nearest(frames, when, window) if window else pick_latest_before(frames, when)
            if frame is None:
                raise RuntimeError(f'{name}: no SDO frame in the window near {when:%Y-%m-%d %H:%M} UTC')
            original = f'{frame:%Y%m%d_%H%M%S}_1024_0131.jpg'
            jobs.append((f'{name}.webp', sdo_url(frame), original, 1024, 'sdo',
                         SDO_MAX_BYTES))
    for i in range(7):
        d = (start + timedelta(days=i)).isoformat()
        fill = gibs_fill_layer(d)
        jobs.append((f'earth-{d}.webp', gibs_url(d), f'{gibs_layer(d)} {d}' + (f' + {fill}' if fill else ''), 1024,
                     'gibs', EARTH_MAX_BYTES))
    fills = {j[0]: gibs_url(j[0][6:16], layer=gibs_fill_layer(j[0][6:16])) for j in jobs
             if j[4] == 'gibs' and gibs_fill_layer(j[0][6:16])}

    downloaded = []
    for file, url, original, width, credit, budget in jobs:
        data = fetch(url)
        if not looks_like_image(data):
            raise RuntimeError(f'{file}: source did not return an image ({url})')
        if file in fills:
            extra = fetch(fills[file])
            if not looks_like_image(extra):
                raise RuntimeError(f'{file}: source did not return an image ({fills[file]})')
            data = fill_gaps(data, extra)
        downloaded.append((file, url, original, width, credit, budget, data))

    raw_dir.mkdir(parents=True, exist_ok=True)
    for file, url, original, width, credit, budget, data in downloaded:
        (raw_dir / original.replace(' ', '_').replace('+', 'and')).write_bytes(data)
        to_webp(data, out_dir / file, width, max_bytes=budget, crop_bottom=SDO_DATE_STRIP if credit == 'sdo' else 0.0)
    manifest = {
        'week': week,
        'downloaded': datetime.now(UTC).strftime('%Y-%m-%d'),
        'flare': None if flare_peak is None else {'begin': flare_begin, 'peak': flare_peak, 'source': 'DONKI FLR (CCMC)'},
        'credits': {k: v for k, v in CREDITS.items() if any(j[4] == k for j in jobs)},
        'files': [
            {'file': f, 'source': u, **({'fill': fills[f]} if f in fills else {}), 'original': o, 'credit': c,
             'label': 'measured'}
            for f, u, o, _, c, _, _ in downloaded
        ],
    }
    (out_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return manifest


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding='utf-8')  # Windows consoles default to cp1251; -I ignores PYTHONIOENCODING
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('week', help='first day of the week, YYYY-MM-DD')
    p.add_argument('--flare-begin', help='YYYY-MM-DDTHH:MMZ (DONKI FLR beginTime)')
    p.add_argument('--flare-peak', help='YYYY-MM-DDTHH:MMZ (DONKI FLR peakTime)')
    p.add_argument('--quiet', action='store_true', help='week without flares: one calm Sun, 12:00 UTC on day 4')
    a = p.parse_args(argv)
    if a.quiet == bool(a.flare_begin and a.flare_peak):
        p.error('give --flare-begin and --flare-peak, or --quiet')
    out = ROOT / 'public' / 'data' / 'media' / a.week
    raw = ROOT / 'scripts' / 'data' / 'raw' / 'media' / a.week
    try:
        m = build_week(a.week, a.flare_begin, a.flare_peak, out, raw)
    except RuntimeError as e:
        print(f'error: {e}', file=sys.stderr)
        return 1
    total = 0
    for f in m['files']:
        size = (out / f['file']).stat().st_size
        total += size
        print(f"{f['file']:28} {size / 1024:7.1f} KB  ← {f['original']}")
    print(f'total {total / 1024:.1f} KB → {out}')
    if total > 1_000_000:
        print('error: week media over the 1 MB budget', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
