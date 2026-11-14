"""Real Sun (SDO) and Earth (GIBS) media for a game week. BUILD TIME ONLY — the game never calls NASA.

Spec: docs/specs/2026-11-14-week1-media.md · Plan: docs/plans/2026-11-14-week1-media.md
Usage: python -I scripts/data/fetch_media.py 2021-10-25 --flare-begin 2021-10-28T15:17Z --flare-peak 2021-10-28T15:35Z
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

from PIL import Image

UTC = timezone.utc
SDO_BROWSE = 'https://sdo.gsfc.nasa.gov/assets/img/browse'
GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'


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


def gibs_url(date: str, width: int = 2048, height: int = 1024) -> str:
    """WMS GetMap for the whole Earth on one day (equirectangular, EPSG:4326)."""
    return (
        f'{GIBS_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={gibs_layer(date)}'
        f'&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH={width}&HEIGHT={height}&FORMAT=image/jpeg&TIME={date}'
    )


def looks_like_image(data: bytes) -> bool:
    """True for JPEG or PNG bytes; error pages (XML/HTML) and empty bodies are rejected."""
    return data.startswith(b'\xff\xd8\xff') or data.startswith(b'\x89PNG\r\n\x1a\n')


SDO_CREDIT = 'Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.'
GIBS_CREDIT = 'NASA EOSDIS GIBS / Worldview'
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


def build_week(week: str, flare_begin: str, flare_peak: str, out_dir: Path, raw_dir: Path, fetch=fetch) -> dict:
    """Download, check and convert all media for a week. Nothing is written to out_dir unless every
    source returned a real image and every frame was found (spec acceptance 3)."""
    begin, peak = _utc(flare_begin), _utc(flare_peak)
    day = peak.strftime('%Y-%m-%d')
    listing_url = f'{SDO_BROWSE}/{peak:%Y/%m/%d}/'
    frames = parse_sdo_listing(fetch(listing_url).decode('utf-8', 'replace'), day)
    chosen = {
        'sdo-peak': pick_nearest(frames, peak, timedelta(minutes=15)),
        'sdo-before': pick_latest_before(frames, begin - timedelta(minutes=60)),
    }
    for name, frame in chosen.items():
        if frame is None:
            raise RuntimeError(f'{name}: no SDO frame in the window on {day} ({listing_url})')

    jobs = []  # (file name, source url, original name, width, credit, max bytes)
    for name, frame in chosen.items():
        original = f'{frame:%Y%m%d_%H%M%S}_1024_0131.jpg'
        jobs.append((f'{name}.webp', f'{SDO_BROWSE}/{frame:%Y/%m/%d}/{original}', original, 1024, 'sdo', SDO_MAX_BYTES))
    start = Date.fromisoformat(week)
    for i in range(7):
        d = (start + timedelta(days=i)).isoformat()
        jobs.append((f'earth-{d}.webp', gibs_url(d), f'{gibs_layer(d)} {d}', 1024, 'gibs', EARTH_MAX_BYTES))

    downloaded = []
    for file, url, original, width, credit, budget in jobs:
        data = fetch(url)
        if not looks_like_image(data):
            raise RuntimeError(f'{file}: source did not return an image ({url})')
        downloaded.append((file, url, original, width, credit, budget, data))

    raw_dir.mkdir(parents=True, exist_ok=True)
    for file, url, original, width, credit, budget, data in downloaded:
        (raw_dir / original.replace(' ', '_')).write_bytes(data)
        to_webp(data, out_dir / file, width, max_bytes=budget, crop_bottom=SDO_DATE_STRIP if credit == 'sdo' else 0.0)
    manifest = {
        'week': week,
        'downloaded': datetime.now(UTC).strftime('%Y-%m-%d'),
        'flare': {'begin': flare_begin, 'peak': flare_peak, 'source': 'DONKI FLR (CCMC)'},
        'credits': {'sdo': SDO_CREDIT, 'gibs': GIBS_CREDIT},
        'files': [
            {'file': f, 'source': u, 'original': o, 'credit': c, 'label': 'measured'}
            for f, u, o, _, c, _, _ in downloaded
        ],
    }
    (out_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return manifest


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding='utf-8')  # Windows consoles default to cp1251; -I ignores PYTHONIOENCODING
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('week', help='first day of the week, YYYY-MM-DD')
    p.add_argument('--flare-begin', required=True, help='YYYY-MM-DDTHH:MMZ (DONKI FLR beginTime)')
    p.add_argument('--flare-peak', required=True, help='YYYY-MM-DDTHH:MMZ (DONKI FLR peakTime)')
    a = p.parse_args(argv)
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
