# Greenhouse (Garden) interior and entrance: sources

All facts below come from NASA API responses fetched on 15 Nov 2026 (copies in `sources/raw/`).
Searches: NTRS `https://ntrs.nasa.gov/api/citations/search?q=<words>&page.size=10`. Images:
`https://images-api.nasa.gov/search?q=<words>&media_type=image`, then `https://images-api.nasa.gov/asset/<nasa_id>`.
"Fit to shell" means the ASTRA shell sets the size, and the real NASA value is given next to it.

## What was searched and not found

- **Prototype Lunar Greenhouse (U. Arizona CEAC)**: NTRS `q=prototype lunar greenhouse` returned 1 hit, and it is
  not the PLG (20230008045, a student Mars OASIS manual). `q=lunar greenhouse cable culture`,
  `q=Mars Lunar Greenhouse MLGH`, `q=Giacomelli greenhouse` and `q=Sadler lunar greenhouse cable culture` all
  returned 0. Image Library `q=prototype lunar greenhouse` returned 0, and `q=lunar greenhouse` returned 15 hits:
  2013 International Space Apps Challenge event photos at KSC (e.g. 2013-2100) and one 2009 Vandenberg photo, none of
  a greenhouse. **Nothing from the PLG is used.** No cable-culture system and no PLG sizes appear in the
  model.
- Image Library `q=EDEN ISS greenhouse` returned 0. NTRS `q=South Pole Food Growth Chamber` returned 2 hits
  (20020002223 CELSS Antarctic Analog Project overview, no PDF link; 20210017183 "Plants in Space, Veggie, and Space
  Crop Production", no PDF link), so nothing from the South Pole chamber is used. The EDEN ISS facts below come from
  NTRS posters.

## Table

| object | value used | NASA value | source (API request, doc id / page or nasa_id) |
|---|---|---|---|
| Grow tray | 0.445 × 0.267 × 0.105 m, white | fibreglass tray 44.5 cm L × 26.7 cm W × 10.5 cm H | NTRS `q=Plant atrium deep space habitat` → **20130014500** (Massa et al., *Plant Atrium System for Food Production in NASA's Deep Space Habitat Tests*), p.4 |
| Pots per tray | 8 square pots, 10.2 cm, in 2 groups of 4 with a centre insert | "eight 10.2 cm square plant pots separated into two groups of four by a custom-built center insert" | 20130014500 p.4 |
| Float stick in the insert (orange) | 1 per tray | the insert held "a float stick and a water transfer funnel"; the float stick shows the standing water level (kept 2–3 cm) | 20130014500 p.4 |
| Drip line into each insert funnel | 1 per tray column | water transfer funnel in the insert; bottom watering with a perched water table | 20130014500 p.4 |
| Crops | butterhead lettuce (green), 'Outredgeous' red romaine, mizuna, 'Red Robin' dwarf tomato on stakes | Atrium: 'Outredgeous' red romaine, 'Fiandria' green butterhead, mizuna (plus radish, basil, sweetpotato). EDEN ISS (Antarctica): mizuna, 'Outredgeous', 'Red Robin' dwarf cherry red tomato, pepper | 20130014500 p.3; NTRS `q=Outredgeous lettuce mizuna` → **20240001584** p.1 (EDEN ISS 2021 crops); NTRS `q=EDEN ISS` → **20220016434** p.2–3 |
| Matches the game | lettuce and staked dwarf tomato, same leaf/fruit colours as `Crops.tsx` | the game uses lettuce + "staked dwarf tomatoes … as on the space station's Veggie units" | game source `src/scene/parts/Crops.tsx` (not NASA; kept for consistency) |
| Seedlings in starter plugs (seed box on the station shelf) | 9 plugs with sprouts | "pregerminate seedlings in Jiffy starter plugs … transport them … and transplant them into our trays" | 20130014500 p.4 |
| Growth stages | seedlings → young → mature → fruiting | plants grown from seed/plugs, transplanted, then harvested | 20130014500 p.3–4 |
| Lower-tier plant space | 0.42 m (tray rim 0.425 to magenta bar 0.841) (fit to shell) | Veggie max height 47.0 cm empty / 41.9 cm with root mat; APH max shoot height 45 cm | NTRS `q=Veggie vegetable production system` → **20160005059** p.1; NTRS `q=advanced plant habitat` → **20160005065** p.1 |
| Upper-tier plant space | 0.28 m (tray rim 1.000 to white panel 1.281), seedlings/young only (fit to shell: the arch is only 1.46 m tall above the deck) | as above | as above |
| Magenta LED bars (`glow_grow` #ff6fd8) | 2 bars per lower tier | Veggie LEDs: red 630 nm, blue 455 nm, green 530 nm; Atrium "UFO" LEDs: 630 nm red + 460 nm blue, 44 red : 6 blue, "cast a purple light" | 20160005059 p.1; 20130014500 p.1, p.5; photos **KSC-2014-2470** (Veggie with red/blue/green LEDs on, magenta glow; Images `q=veggie LED lettuce`), **jsc2022e072973** (Images `q=red robin tomato veggie`), **iss060e006116** (Images `q=mizuna`) |
| White LED panels (`glow_white`) | 3 flat panels over each upper tier | 2012 Atrium: "flat panel banks of white LEDs … broad spectrum light with more uniform distribution", the crew liked the extra light | 20130014500 p.1 (abstract) |
| APH light/environment note | no spectrum mixing modelled; one magenta + one white kind only | APH: red 630–660, blue 450, green 525, far red 730 nm, white; PPF 0–1000 | 20160005065 p.1 |
| Sensor pods (white box with a green status light) | 1 per rack | the atrium was "outfitted with sensors for monitoring temperature, relative humidity, CO2 and light" | 20130014500 p.3 |
| Environment station: fan grille | one fan, separate node `greenhouse_fan` | Veggie "Cabin Air Fan Settings: Low / High / Off"; APH air flow controlled 0.3–1.5 m/s | 20160005059 p.1; 20160005065 p.1 |
| Environment station: screen with 3 status shapes, no text | green / white / magenta squares | APH monitors and controls RH 50–86 %, CO2 400–5000 ppm, temperature 18–30 °C | 20160005065 p.1 |
| Water/nutrient reservoir (blue tank), pump, valves, return drain | tank r 0.16 × 0.55 m (size not sourced: kept plain, fit to shell) | Veggie "a reservoir that supplies water via capillary action to root pillows"; APH "Water and Nutrient Delivery", "RH condensate measured and recycled" | 20160005059 p.1; 20160005065 p.1 |
| Multi-tier racks with white trays and water pipes | 2 racks × 2 tiers | NASA KSC Biomass Production Chamber photo: lettuce in white trays on stacked racks, white water pipes with black fittings | Images `q=biomass production chamber` → **KSC-391c6479-10** (1991 BPC lettuce harvest) |
| Rack frame (posts, shelf plates, rails), walkway, station cabinet sizes | racks x −1.70 … 1.08, posts 25 mm, shelves at 0.30 / 0.875; walkway 0.66 m wide; station 0.40 × 1.24 m | **no NASA source** for these sizes: kept plain, sized to hold the sourced trays and to fit the shell | — (fit to shell) |
| Duct collar on the west wall | steel ring r 0.04 at three (−2.13, 0.95, +0.30) | none: placed where ASTRA's own environmental-unit pipe comes through the west cap | ASTRA `life.ts` line 244 (not NASA) |
| Door type | single "submarine" hatch, stadium-shaped leaf, round view port at the top, cross stiffeners, opens inward | "hatches in the gravity environment must accommodate a walking astronaut looking more like submarine hatches"; Fig. 7 "Submarine" hatch drawn as a tall rounded oval with a round window at the top and a cross; "pressure assisted hatches are used" | NTRS `q=hatch lunar habitat` → **20080018968** (Griffin, *Lunar Habitat Airlock/Suitlock*), p.1 and p.4 (Fig. 6, Fig. 7) |
| Door clear opening | 0.80 m wide × 1.27 m tall (fit to shell: the arch is 1.46 m tall above the deck, so a 1.83 m hatch cannot fit) | submarine hatch 0.86 m (34") × 1.83 m (72"); ISS hatch 1.27 m (50") square | 20080018968 p.4 Fig. 7 (figure read from the page image; the PDF text layer only has "1.27 m (50\")" and "1.83 m") |
| Door swing | 90° inward, 1.25 s (angle and time not sourced) | "pressure assisted hatches are used in both concepts" (our reading: cabin pressure pushes the leaf onto its seal, so it opens inward) | 20080018968 p.4 |
| No airlock vestibule | single hatch only | "because EVA uses the buddy-system, airlocks should accommodate at least 2 crew members at once". A 2-crew airlock does not fit in a 4.4 m × 1.5 m half-cylinder without losing the grow room. | 20080018968 p.5 |

## Colours

| material | hex | where it comes from |
|---|---|---|
| int_white | #e8ecf2 | ASTRA palette `C.white`. Trays are white in BPC photo KSC-391c6479-10. |
| int_steel | #8b94a3 | ASTRA `C.steel` (rack frames) |
| int_dark | #2a3140 | ASTRA `C.dark`. Pot rims, walkway plate, drip lines (black fittings in KSC-391c6479-10). |
| int_window | #1d2a3a | dark glass for the hatch port, screen and tank sight glass (ASTRA dark window idea) |
| int_media | #3e2c22 | ASTRA life.ts media colour. No NASA colour was found for the arcillite/peat mix. |
| int_leaf | #36b84e | game `Crops.tsx` LEAF[4] (healthy) |
| int_leaf_light | #6fa244 | game `Crops.tsx` LEAF[2]. Light green like the BPC lettuce in KSC-391c6479-10. |
| int_leaf_red | #8a2c42 | 'Outredgeous' red romaine as seen in **KSC-2014-2904** (Images `q=veggie LED lettuce`): deep red-purple leaves |
| int_tomato | #d2402f | game `Crops.tsx` fruit. Red cherry tomatoes in jsc2022e072973. |
| int_orange | #ff8a3d | ASTRA `C.orange` (handles, float sticks, valves) |
| int_blue | #2f6fd6 | ASTRA `C.blue` for the nutrient supply lines (the BPC photo shows white pipes, so the return drain is white) |
| glow_grow | #ff6fd8 | game `GLOW.grow`. Magenta red+blue LED light in KSC-2014-2470, jsc2022e072973 and iss060e006116. |
| glow_white | #f4f8ff | white LED panels (20130014500 p.1) |
| glow_status | #3ee39a | ASTRA status-lamp green |

## ASTRA shell facts (read from `ref/greenhouse_shell.blend` and `life.ts`, not NASA)

- Deck top z 0.23 (Blender) / y 0.23 (three). The glazing axis is at y0 = 0.213, R 1.5, caps at x = ±2.2. The arch ribs are a torus R 1.52 with tube 0.045, so the inner clear radius is 1.475.
- **The glazing bug was checked in Blender.** The glass mesh `greenhouse_0_part` spans three y −1.29 … 1.71 and three z 0 … +1.5 only.
  `CylinderGeometry(R, R, L, 48, 1, true, -π/2, π)` with `rotation.z = π/2` builds the half-cylinder on the +z
  (front) side, from 1.5 m **below the deck** to the top, instead of an arch over the top. Two results: the back
  upper quarter (three z < 0, above the deck) has **no glass**, and the front lower quarter pokes through the deck and
  the ground. The fix is in `life.ts` line 210: `thetaStart` `-Math.PI / 2` → `0` (local x = sin θ ≥ 0 becomes
  world +y after the z-rotation). Our interior is fitted to the intended arch (ribs/stringers), which are correct.

- Deck top three y 0.232 (our floor). The intended arch is only 1.475 − 0.019 = 1.456 m tall above the deck at the
  centre line, so a 1.8 m astronaut cannot stand upright inside at native scale (HANDOFF "Scale note").
- ASTRA's environmental-unit pipe (`life.ts` line 244, steel `#9aa3b4`) runs from (−2.3, 0.85, 0.3) through the west
  cap to (−1.9, 1.113, 0.3), i.e. 0.3 m into the room. The game cuts it at the cap (HANDOFF); our duct collar marks the
  entry.

## Exact requests behind the table

NTRS searches (all `&page.size=10`; responses in `sources/raw/ntrs_<words>_.json`):
- `https://ntrs.nasa.gov/api/citations/search?q=Plant%20atrium%20deep%20space%20habitat` → 20130014500
- `https://ntrs.nasa.gov/api/citations/search?q=Veggie%20vegetable%20production%20system` → 20160005059
- `https://ntrs.nasa.gov/api/citations/search?q=advanced%20plant%20habitat` → 20160005065
- `https://ntrs.nasa.gov/api/citations/search?q=Outredgeous%20lettuce%20mizuna` → 20240001584
- `https://ntrs.nasa.gov/api/citations/search?q=EDEN%20ISS` → 20220016434
- `https://ntrs.nasa.gov/api/citations/search?q=hatch%20lunar%20habitat` → 20080018968
- not-found searches: `q=prototype%20lunar%20greenhouse` (1 hit, 20230008045), `q=lunar%20greenhouse%20cable%20culture`,
  `q=Mars%20Lunar%20Greenhouse%20MLGH`, `q=Giacomelli%20greenhouse`, `q=Sadler%20lunar%20greenhouse%20cable%20culture`
  (0 hits each), `q=South%20Pole%20Food%20Growth%20Chamber` (2 hits, see above).

NTRS PDFs read (copies `sources/raw/ntrs_<id>.pdf`):
- `https://ntrs.nasa.gov/api/citations/20130014500/downloads/20130014500.pdf` (13 p.; used p.1, 3, 4, 5)
- `https://ntrs.nasa.gov/api/citations/20160005059/downloads/20160005059.pdf` (Veggie fact sheet, p.1)
- `https://ntrs.nasa.gov/api/citations/20160005065/downloads/20160005065.pdf` (APH fact sheet, p.1)
- `https://ntrs.nasa.gov/api/citations/20240001584/downloads/Nutrition%20of%20Antarctic%20grown%20Crops.pdf` (poster, p.1)
- `https://ntrs.nasa.gov/api/citations/20220016434/downloads/EDEN%20ASGSR.pdf` (14 p.; used p.3 crop list)
- `https://ntrs.nasa.gov/api/citations/20080018968/downloads/20080018968.pdf` (12 p.; used p.1, 4, 5)

Downloaded, read, **not used** for any value: 19960029065 (BPC performance; scanned, no text layer), 20050182979,
20090029954, 20170008500, 20200003680, 20210023241, 20230007961, 20230008045.

NASA Image and Video Library (search `https://images-api.nasa.gov/search?q=<words>&media_type=image`, then
`https://images-api.nasa.gov/asset/<nasa_id>` → `https://images-assets.nasa.gov/image/<nasa_id>/<nasa_id>~small.jpg`,
copies in `sources/raw/img/`):
- KSC-391c6479-10 (`q=biomass%20production%20chamber`): caption "Plant researchers Lisa Ruffe and Neil Yorio prepare
  to harvest a crop of Waldann's Green Lettuce from KSC's Biomass Production Chamber (BPC)" (photo 8 Oct 1991). Seen in
  the photo: white trays on stacked shelves, white pipes with black fittings.
- KSC-2014-2470 (`q=veggie%20LED%20lettuce`): Veggie control chamber with "red, blue and green LED lights" on; the
  photo is magenta.
- KSC-2014-2904 (`q=veggie%20LED%20lettuce`): harvested 'Outredgeous' red lettuce; the photo shows deep red-purple
  leaves.
- jsc2022e072973 (`q=red%20robin%20tomato%20veggie`): "Veg-05 'Red Robin' dwarf tomato growing in Veggie hardware";
  red cherry tomatoes under magenta light.
- iss060e006116 (`q=mizuna`): Veg-04A mizuna in a Veggie chamber on the ISS, 9 Jul 2019.
- KSC-20170316-PH_AAG01_0001 (`q=advanced%20plant%20habitat`): APH prototype; downloaded, not used for any value.
