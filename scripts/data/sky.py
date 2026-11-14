"""Sun and Earth seen from the base for every week in src/engine/weeks.json → src/engine/sky.json. BUILD TIME ONLY.

Source: JPL Horizons API (no key), observer on the Moon at the site, one value per day at 12:00 UTC.
  Earth: COMMAND='399', QUANTITIES='4,10' → elevation and lit fraction.
  Sun:   COMMAND='10',  QUANTITIES='4'    → azimuth (+ site longitude = measured from lunar longitude 0, the way
         to Earth, as the scene uses it) and the true elevation of the Sun's centre.
The game draws the Sun at a fixed 1.5° (sun_el_deg, a game rule); sun_el_true_deg records what Horizons gives.

Usage: python -I scripts/data/sky.py
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date as Date
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE_LAT, SITE_LON = -89.45, 222.69  # Shackleton–de Gerlache ridge (concept 3.0 §05)
HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api'
ROW = re.compile(r'^\s*\d{4}-\w{3}-\d{2} \d{2}:\d{2}\s+\S*\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)')


def horizons_url(body: str, start: str, stop: str) -> str:
    q = {
        'format': 'text', 'COMMAND': f"'{body}'", 'EPHEM_TYPE': "'OBSERVER'", 'CENTER': "'coord@301'",
        'COORD_TYPE': "'GEODETIC'", 'SITE_COORD': f"'{SITE_LON},{SITE_LAT},0'",
        'START_TIME': f"'{start} 12:00'", 'STOP_TIME': f"'{stop} 12:00'", 'STEP_SIZE': "'1 d'",
        'QUANTITIES': "'4,10'",
    }
    return HORIZONS + '?' + urllib.parse.urlencode(q)


def parse_rows(text: str) -> list[tuple[float, float, float]]:
    """(azimuth, elevation, lit %) per row between $$SOE and $$EOE; exactly 7 rows or an error."""
    body = text.split('$$SOE', 1)[-1].split('$$EOE', 1)[0]
    rows = [tuple(float(x) for x in m.groups()) for m in map(ROW.match, body.splitlines()) if m]
    if len(rows) != 7:
        raise RuntimeError(f'Horizons gave {len(rows)} rows, expected 7')
    return rows


def week_days(earth: list[tuple], sun: list[tuple]) -> list[dict]:
    return [
        {
            'day': i + 1,
            'sun_az_deg': round((s[0] + SITE_LON) % 360) % 360,
            'earth_el_deg': round(e[1], 1),
            'earth_phase': round(e[2] / 100, 2),
            'sun_el_true_deg': round(s[1], 1),
        }
        for i, (e, s) in enumerate(zip(earth, sun))
    ]


def _inline(v) -> str:
    s = json.dumps(v, ensure_ascii=False, separators=(', ', ': '))
    return '{ ' + s[1:-1] + ' }' if isinstance(v, dict) else s


def dump(sky: dict) -> str:
    """sky.json in its hand-readable layout: one line per day, weeks in date order."""
    lines = ['{'] + [f' {json.dumps(k)}: {_inline(v)},' for k, v in sky.items() if k != 'weeks'] + [' "weeks": {']
    weeks = list(sky['weeks'].items())
    for i, (wid, days) in enumerate(weeks):
        lines.append(f'  {json.dumps(wid)}: [')
        lines += [f'   {_inline(d)}' + (',' if j < len(days) - 1 else '') for j, d in enumerate(days)]
        lines.append('  ]' + (',' if i < len(weeks) - 1 else ''))
    return '\n'.join(lines + [' }', '}']) + '\n'


def fetch(url: str) -> str:
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as res:
                return res.read().decode('utf-8')
        except OSError:
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f'download failed after 3 tries: {url}')


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    path = ROOT / 'src' / 'engine' / 'sky.json'
    sky = json.loads(path.read_text(encoding='utf-8'))
    weeks = json.loads((ROOT / 'src' / 'engine' / 'weeks.json').read_text(encoding='utf-8'))['weeks']
    out = {}
    for w in sorted(weeks, key=lambda w: w['id']):
        start = Date.fromisoformat(w['id'])
        stop = (start + timedelta(days=6)).isoformat()
        earth = parse_rows(fetch(horizons_url('399', w['id'], stop)))
        sun = parse_rows(fetch(horizons_url('10', w['id'], stop)))
        d = week_days(earth, sun)
        kept = sky.get('weeks', {}).get(w['id'])
        if kept:
            # A week the team already checked keeps its numbers; Horizons only adds the true Sun elevation.
            for k, h in zip(kept, d):
                if abs(k['earth_el_deg'] - h['earth_el_deg']) > 0.1 or abs((k['sun_az_deg'] - h['sun_az_deg'] + 180) % 360 - 180) > 1:
                    print(f"{w['id']} day {k['day']}: kept values differ from Horizons: {k} vs {h}", file=sys.stderr)
            d = [{**k, 'sun_el_true_deg': h['sun_el_true_deg']} for k, h in zip(kept, d)]
        out[w['id']] = d
        print(f"{w['id']}: Earth {min(x['earth_el_deg'] for x in d):+.1f}..{max(x['earth_el_deg'] for x in d):+.1f}°, "
              f"lit {d[0]['earth_phase']:.2f}→{d[-1]['earth_phase']:.2f}, Sun centre "
              f"{min(x['sun_el_true_deg'] for x in d):+.1f}..{max(x['sun_el_true_deg'] for x in d):+.1f}°, "
              f"Sun az {d[0]['sun_az_deg']:.0f}→{d[-1]['sun_az_deg']:.0f}")
    sky['weeks'] = out
    sky['about'] = (
        'Sun and Earth seen from the base, one value per day at 12:00 UTC. Label: computed. All values from JPL '
        'Horizons (observer on the Moon at the site below), built by scripts/data/sky.py on '
        f'{Date.today().isoformat()}; week 2021-10-25 keeps its checked values (Sun azimuth from the concept 3.0 '
        'table, within 0.6° of Horizons). Sun azimuth is measured from lunar longitude 0 (the way to Earth) = Horizons '
        'local azimuth + site longitude, whole degrees. sun_el_true_deg is the Horizons elevation of the Sun\'s centre; the game '
        'draws the Sun at sun_el_deg (1.5°), a game rule, so the low Sun is true to the place but the number is not '
        'measured. Earth elevation does not include the ridges around the site.'
    )
    sky['source'] = (
        f"{HORIZONS}?format=text&COMMAND='399'&EPHEM_TYPE='OBSERVER'&CENTER='coord@301'&COORD_TYPE='GEODETIC'"
        f"&SITE_COORD='{SITE_LON},{SITE_LAT},0'&START_TIME='<week> 12:00'&STOP_TIME='<week + 6 d> 12:00'"
        "&STEP_SIZE='1 d'&QUANTITIES='4,10' (Sun: COMMAND='10')"
    )
    path.write_text(dump(sky), encoding='utf-8', newline='\n')
    print(f'wrote {path} ({len(out)} weeks)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
