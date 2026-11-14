"""Sun (SDO) and Earth (GIBS) media for every week in src/engine/weeks.json. BUILD TIME ONLY.

Which flare a week's Sun pictures show (storm_flare): the strongest flare on the day the week's dose level first
reaches its maximum, or the day before; if neither day has one, the strongest earlier in the week; in a week whose
dose never rises (level 0 all week), the strongest flare of the week. A week without any flare gets one calm Sun
(fetch_media --quiet). Begin and peak times come from the raw DONKI FLR download (npm run donki -- --weeks).

Usage: python -I scripts/data/media_all.py [--force]   (weeks that already have a manifest are skipped)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_media import build_week  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CLASS = {'A': 0, 'B': 1, 'C': 2, 'M': 3, 'X': 4}


def class_rank(cls: str) -> float:
    """GOES class as one number: X1.0 > M9.8, M5.1 > M5.0."""
    return CLASS[cls[0]] * 100 + float(cls[1:])


def storm_flare(days: list[dict]) -> tuple[int, str, str] | None:
    """(day number, class, peak HH:MM UTC) of the flare the week's Sun pictures show, or None for a quiet week."""
    flares = [(d['day'], f['cls'], f['peak_utc']) for d in days for f in d.get('flares', [])]
    if not flares:
        return None
    top = max(d['level'] for d in days)

    def strongest(cands):
        # strongest first; on a tie the earlier flare (deterministic)
        return max(cands, key=lambda f: (class_rank(f[1]), -f[0], [-int(x) for x in f[2].split(':')])) if cands else None

    if top == 0:
        return strongest(flares)
    peak_day = min(d['day'] for d in days if d['level'] == top)
    return strongest([f for f in flares if peak_day - 1 <= f[0] <= peak_day]) or \
        strongest([f for f in flares if f[0] <= peak_day]) or strongest(flares)


def donki_times(week: str, date: str, cls: str, peak: str) -> tuple[str, str]:
    """(beginTime, peakTime) of that flare in the raw DONKI FLR download."""
    raw = json.loads((ROOT / 'scripts' / 'data' / 'raw' / 'donki' / f'{week}-events.json').read_text(encoding='utf-8'))
    hits = [f for f in raw['flr'] if f['classType'] == cls and f['peakTime'] == f'{date}T{peak}Z']
    if len(hits) != 1:
        raise RuntimeError(f'{week}: {len(hits)} DONKI FLR entries for {cls} at {date} {peak}')
    return hits[0]['beginTime'], hits[0]['peakTime']


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    weeks = json.loads((ROOT / 'src' / 'engine' / 'weeks.json').read_text(encoding='utf-8'))['weeks']
    failed = 0
    for w in weeks:
        week = w['id']
        out = ROOT / 'public' / 'data' / 'media' / week
        if (out / 'manifest.json').exists() and '--force' not in argv:
            print(f'{week}: has media, skipped')
            continue
        pick = storm_flare(w['days'])
        try:
            if pick is None:
                m = build_week(week, None, None, out, ROOT / 'scripts' / 'data' / 'raw' / 'media' / week)
                what = 'quiet week: calm Sun, day 4 12:00 UTC'
            else:
                n, cls, peak = pick
                date = w['days'][n - 1]['date']
                begin, peak_t = donki_times(week, date, cls, peak)
                m = build_week(week, begin, peak_t, out, ROOT / 'scripts' / 'data' / 'raw' / 'media' / week)
                what = f'{cls} day {n} {date} peak {peak} UTC'
        except RuntimeError as e:
            print(f'{week}: error: {e}', file=sys.stderr)
            failed += 1
            continue
        total = sum((out / f['file']).stat().st_size for f in m['files'])
        print(f'{week}: {what}; {len(m["files"])} files, {total / 1024:.0f} KB')
        if total > 1_000_000:
            print(f'{week}: error: over the 1 MB budget', file=sys.stderr)
            failed += 1
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
