"""Real Sun (SDO) and Earth (GIBS) media for a game week. BUILD TIME ONLY — the game never calls NASA.

Spec: docs/specs/2026-11-14-week1-media.md · Plan: docs/plans/2026-11-14-week1-media.md
Usage: python -I scripts/data/fetch_media.py 2021-10-25 --flare-begin 2021-10-28T15:17Z --flare-peak 2021-10-28T15:35Z
"""
import re
from datetime import datetime, timedelta, timezone

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
