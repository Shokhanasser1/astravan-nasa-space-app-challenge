# Data (lane Data — Shoxjahon aka's Claude sessions; he reviews the numbers)

All NASA data is fetched and checked at build time, trimmed, and shipped with the game (`src/engine/` for
weeks and sky, `public/data/media/` for images). The game never calls
a NASA server while it runs. Every on-screen number has one of four labels: **measured**, **computed**,
**rule**, **story** (concept 3.0, section 05).

## Files

| File | What | Label |
|---|---|---|
| `src/engine/weeks.json` (imported, bundled) | 14 real weeks (2012–2024): per day date, mean/max µGy/h, hours measured, ratio, level 0–4, alert, flares (DONKI FLR notifications), particles (DONKI SEP) | measured (levels: rule) |
| `src/engine/sky.json` | all 14 weeks, per day: Sun azimuth, Earth elevation and lit fraction, and `sun_el_true_deg` (the real elevation of the Sun's centre; the game still draws the Sun at the 1.5° game rule); site near Shackleton–de Gerlache ridge. All from JPL Horizons, built by `python -I scripts/data/sky.py` (15 Nov) | computed |
| `public/data/media/<week>/sdo-before.webp`, `sdo-peak.webp` | SDO AIA 131 Å: an hour before the week's storm flare and at its peak (12 weeks with flares); `sdo-day.webp` instead in the two quiet weeks (2018-08-06, 2020-06-01): the calm Sun at 12:00 UTC on day 4, `flare: null` in the manifest | measured |
| `public/data/media/<week>/earth-<date>.webp` | GIBS true-colour Earth for each day, wrapped on the globe; all 14 weeks | measured |
| `public/data/media/<week>/epic.webp` | DSCOVR EPIC photo of the whole Earth on the storm day (the nearest day of the week that has one, same clock time; `time` in the manifest) — truth screen. 7 weeks: none before mid-2015, and EPIC lists 12–13 Sep 2017 but returns no images for them | measured |
| `public/data/media/<week>/moon.webp` | The Moon as Earth saw it at the storm's hour (SVS Dial-A-Moon, north up: the south-pole base is at the bottom edge); `phase_pct` in the manifest — truth screen. All 14 weeks | computed |
| `public/data/media/<week>/manifest.json` | the list of files above with request URL, download date and label — **look files up here**, do not build names by hand | — |
| `public/data/terrain/site.json` | the ground around the base for the 3D demo: heights on a 5 m grid ±160 m (LOLA Site01) and on 44 rings × 256 directions out to 60 km (LOLA 80–90°S 20 m/px and its overviews), metres above the site minus the Moon's curvature (r²/2R); turned so lunar longitude 0 (toward Earth) lies under the demo sky's Earth. Built by `scripts/data/moon_terrain.py` (HTTP range reads, `lola_tiff.py`), tests `scripts/data/test_moon_terrain.py` | measured (heights) + computed |
| `public/data/facts.json` | every number in the game with its source link (fact sheet): 17 facts, each with value, unit, label, source {title, url}, the quoted page text and the sentence key `data.fact.<id>`; drafts and sources in `docs/specs/2026-11-14-facts.md`, checked by `src/lib/facts.test.ts` | per fact |

Format of a day in `weeks.json` (values as built for 28 Oct 2021; that day also has two M-class flares):

```json
{ "day": 4, "date": "2021-10-28", "mean_uGy_h": 114.2, "max_uGy_h": 567.3, "hours": 23,
  "ratio": 9.19, "level": 1, "alert": true, "watch": false, "r_label": "measured",
  "flares": [{ "peak_utc": "15:35", "cls": "X1.0", "source": "DONKI FLR" }],
  "particles": [{ "first_seen_utc": "16:16", "channel": "SEP", "source": "DONKI SEP" }] }
```

Optional `hourly` (24 ratios, `null` = no reading that hour) per day drives the dosimeter hour by hour and the
truth-screen curve.
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
| SDO | `https://sdo.gsfc.nasa.gov/assets/img/browse/YYYY/MM/DD/` → `YYYYMMDD_HHMMSS_1024_0131.jpg` nearest the flare | No key. **The browse archive starts in 2016** (2012–2015 folders are 404, checked 15 Nov). Bundle the file: SDO does not allow cross-origin canvas use. During big flares AIA's short exposures wash a frame out (2017-09-10 15:57 and 16:13): the peak picture takes the nearest clean frame within 30 min (16:28) |
| Helioviewer (SDO AIA 131 before 2016) | `https://api.helioviewer.org/v2/getClosestImage/?date=…Z&sourceId=9` → `…/v2/takeScreenshot/?date=…Z&imageScale=2.4&layers=[SDO,AIA,AIA,131,1,100]&x0=0&y0=0&width=1024&height=1024&display=true&watermark=false` | No key. Same AIA 131 data rendered by Helioviewer.org (NASA/ESA project), framed like the browse images; used for the six weeks of 2012–2014 |
| GIBS | `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg&TIME=YYYY-MM-DD` | No key. From 2016 `VIIRS_SNPP_CorrectedReflectance_TrueColor` (no gaps; GIBS has no VIIRS for 2012–2015, the picture comes back black). Before 2016 the black gaps between MODIS Terra orbits are filled from `MODIS_Aqua_CorrectedReflectance_TrueColor` of the same day (`fill` in the manifest); small diamonds at the equator and the polar night stay black |
| DSCOVR EPIC | `https://epic.gsfc.nasa.gov/api/natural/date/YYYY-MM-DD` → `https://epic.gsfc.nasa.gov/archive/natural/YYYY/MM/DD/jpg/<image>.jpg` | No key. From 2015-06-13. Credit: "NASA EPIC Team" (https://epic.gsfc.nasa.gov/about: free to reuse with credit) |
| SVS Dial-A-Moon | `https://svs.gsfc.nasa.gov/api/dialamoon/YYYY-MM-DDTHH:MM` → `image.url` (730 px, one SVS "Moon Phase and Libration" page per year, e.g. https://svs.gsfc.nasa.gov/3894 for 2012) | No key; undocumented endpoint behind the SVS pages. Credit: "NASA/Goddard Space Flight Center Scientific Visualization Studio" |
| JPL Horizons | `https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='10'&EPHEM_TYPE='OBSERVER'&CENTER='coord@301'&COORD_TYPE='GEODETIC'&SITE_COORD='222.69,-89.45,0'&START_TIME=…&STOP_TIME=…&STEP_SIZE='1 d'&QUANTITIES='4,10'` | Builds `sky.json` (`scripts/data/sky.py`). Earth: `COMMAND='399'` |
| SOHO LASCO | `soho.nascom.nasa.gov/hotshots/2000_07_14` | One hand-picked "snow" image for the Data page |

All requests above except SOHO LASCO have been run (2026-11-14). JPL Horizons check of `sky.json`, week 2021-10-25:
Earth lit fraction matched; Earth elevation was 0.6° too high (computed for the pole, not the site) and is now the
Horizons value; Sun azimuth agrees within 0.6° once the site longitude is added (the file measures it from the
Earth-facing meridian); the Sun's centre was 0.1–0.7° below the zero-altitude horizon that week, so the 1.5° Sun
elevation stays labelled a game rule. Do not use the Mars Rover Photos API (archived).

**15 Nov: all 14 weeks have sky and media.** `python -I scripts/data/sky.py` rebuilds `sky.json` from Horizons
(week 2021-10-25 reproduces the checked values: Earth exactly, Sun azimuth within 0.6° of the concept table);
`python -I scripts/data/media_all.py [--force]` builds the media of every week (tests: `test_sky.py`,
`test_media_all.py`, `test_fetch_media.py`). Which flare a week's Sun pictures show: the strongest flare on the day
the dose level first reaches the week's maximum, or the day before; in a week whose level stays 0, the strongest
flare of the week (`media_all.storm_flare`). Picks: 2012-01-20 M8.7 · 2012-03-04 X5.4 · 2012-05-14 M5.1 ·
2013-05-19 M5.0 · 2014-01-04 X1.2 · 2014-10-20 X3.1 · 2017-09-06 X8.2 (10 Sep, the storm's flare, not the X9.3 of
6 Sep) · 2021-10-25 X1.0 · 2023-12-12 X2.8 · 2024-02-20 X6.3 · 2024-03-20 X1.1 · 2024-05-08 X5.8; quiet:
2018-08-06, 2020-06-01. Horizons also confirms the three weeks with Earth below the horizon all week (2012-03-04,
2017-09-06, 2023-12-12: −7° to −3°). **For the team:** the Sun's centre is below the horizon all week in
2012-03-04 (−2.1° to −1.7°) and 2014-01-04 (−2.0° to −1.3°) — the game still shows it at 1.5° (game rule; say so on
the Data page or decide otherwise). SDO's rules (https://sdo.gsfc.nasa.gov/data/rules.php, checked 15 Nov): rule 4,
browse products "are not intended for science analysis or publication"; rule 9, a modified product must be
"clearly label[led]… as being different from the original" — our pictures are cropped and resized browse images,
so the caption says "SDO AIA 131 Å browse image, cropped" and that the colour is false.

Known limits (14 Nov, updated 15 Nov): no week after June 2024 (RadLab ends; iSWA HAPI has CRaTER
to October 2026); the storm starts on day 4 in 8 of 14 weeks; CRaTER measures in lunar orbit behind thin
shielding, so the game shows the ratio to the calm value, never a dose "at the base"; the SDO 131 Å picture is
extreme ultraviolet in false colour; `public/data/facts.json` is built (17 facts, 14 Nov; the `data.fact.*` texts
are still empty, Sarvar checks the numbers), the Data page is not built yet.

## Rules

- Rebuild script and its inputs live in `scripts/data/`; output is deterministic and committed.
- A day with < 18 hours measured → "partly measured" on screen.
- In 3 of 14 weeks (March 2012, September 2017, December 2023) Earth is below the ridge all week: the game says so
  instead of drawing it.
- Credit line for the Data page and References: "Radiation: NASA LRO CRaTER (RadLab). Space weather: NASA DONKI.
  Solar images: NASA/SDO. Earth imagery: NASA EOSDIS GIBS. Sky positions: computed, checked against JPL Horizons."
