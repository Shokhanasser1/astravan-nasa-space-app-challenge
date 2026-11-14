# Data (owner Sarvar)

All NASA data is fetched and checked at build time, trimmed, and shipped with the game (`src/engine/` for
weeks and sky, `public/data/media/` for images). The game never calls
a NASA server while it runs. Every on-screen number has one of four labels: **measured**, **computed**,
**rule**, **story** (concept 3.0, section 05).

## Files

| File | What | Label |
|---|---|---|
| `src/engine/weeks.json` (imported, bundled) | 14 real weeks (2012–2024): per day date, mean/max µGy/h, hours measured, ratio, level 0–4, alert, flares (DONKI FLR notifications), particles (DONKI SEP) | measured (levels: rule) |
| `src/engine/sky.json` | per week, per day: Sun azimuth, Earth elevation and lit fraction; site near Shackleton–de Gerlache ridge | computed |
| `public/data/media/<week>/sdo-<hhmm>.jpg` | SDO 131 Å browse image before the flare and at the peak (1024 px) | measured |
| `public/data/media/<week>/earth-<date>.jpg` | GIBS true-colour Earth for each day, 2048×1024, wrapped on the globe | measured |
| `public/data/facts.json` | every number in the game with its source link (fact sheet) | — |

Format of a day in `weeks.json` (concept v2, section 07, real values for 28 Oct 2021):

```json
{ "day": 4, "date": "2021-10-28", "mean_uGy_h": 114, "max_uGy_h": 567, "hours": 23,
  "ratio": 9.17, "level": 1, "alert": true, "r_label": "measured",
  "flares": [{ "peak_utc": "15:35", "cls": "X1.0", "source": "DONKI notifications FLR" }],
  "particles": [{ "first_seen_utc": "16:35", "channel": ">100 MeV", "source": "DONKI SEP" }] }
```

Optional `hourly_ratio` (24 numbers) per day drives the dosimeter hour by hour and the truth-screen curve.
TypeScript shapes: `src/engine/week.ts`. `npm run check` validates the files.

## DONKI connection (checked 2026-11-14)

`npm run donki -- 2021-10-25 2020-06-01` (or `-- --weeks` for every week in `weeks.json`) fetches flares, particle
events, CMEs and notifications per week from the **CCMC DONKI API, no key needed**, saves raw JSON to
`scripts/data/raw/donki/` (git-ignored) and prints a day-by-day summary to compare with `weeks.json`.

- The `api.nasa.gov/DONKI/...` proxy currently returns **404** (it forwards to `/DONKI-API/get/FLR/` with a trailing
  slash). The team key itself is valid (APOD answers, 10,000 requests/hour); keep it in `scripts/data/.env`
  (`NASA_API_KEY=…`, git-ignored) for other api.nasa.gov services. Never commit or print it.
- Check result: 2021-10-25 week → X1.0 flare peak 28 Oct 15:35 (matches the concept); particle events from 16:16
  (DONKI has six SEP entries that day; the concept's 16:35 ">100 MeV" is one of them — confirm which channel the
  engine uses). 2020-06-01 week → no flares, no particle events (matches "quiet").

## Sources and requests (build time only)

| Source | Request | Notes |
|---|---|---|
| DONKI | `https://api.nasa.gov/DONKI/notifications?startDate=…&endDate=…&type=FLR&api_key=KEY`, `…/DONKI/SEP?…` | Team key in a local `.env`, never committed. CCMC route without key: `https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=…` |
| RadLab · LRO CRaTER | `https://visualization.osdr.nasa.gov/radlab/api/?instrument=CRaTER&timestamp>=…&timestamp<…&absorbed_dose_rate&format=csv` | Hourly, 2009-06-26 → 2024-06-18. Detector CRaTER-D1D2, µGy/h |
| SDO | `https://sdo.gsfc.nasa.gov/assets/img/browse/YYYY/MM/DD/` → `YYYYMMDD_HHMMSS_1024_0131.jpg` nearest the flare | No key. Bundle the file: SDO does not allow cross-origin canvas use |
| GIBS | `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg&TIME=YYYY-MM-DD` | No key. After 2016 also try `VIIRS_SNPP_CorrectedReflectance_TrueColor` (no gaps) |
| JPL Horizons | `https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='10'&EPHEM_TYPE='OBSERVER'&CENTER='coord@301'&COORD_TYPE='GEODETIC'&SITE_COORD='222.69,-89.45,0'&START_TIME=…&STOP_TIME=…&STEP_SIZE='1 d'&QUANTITIES='4'` | Check `sky.json` (PyEphem). Earth: `COMMAND='399'`, `QUANTITIES='4,10'` |
| SOHO LASCO | `soho.nascom.nasa.gov/hotshots/2000_07_14` | One hand-picked "snow" image for the Data page |

Concept 3.0 notes these three requests were written from NASA docs and **not yet run**; run each once (Sarvar)
and cut the moment if a source fails. Do not use the Mars Rover Photos API (archived).

## Rules

- Rebuild script and its inputs live in `scripts/data/`; output is deterministic and committed.
- A day with < 18 hours measured → "partly measured" on screen.
- In 3 of 14 weeks (March 2012, September 2017, December 2023) Earth is below the ridge all week: the game says so
  instead of drawing it.
- Credit line for the Data page and References: "Radiation: NASA LRO CRaTER (RadLab). Space weather: NASA DONKI.
  Solar images: NASA/SDO. Earth imagery: NASA EOSDIS GIBS. Sky positions: computed, checked against JPL Horizons."
