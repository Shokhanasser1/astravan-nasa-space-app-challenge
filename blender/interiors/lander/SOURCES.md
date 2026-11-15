# lander (Lander) — sources

Every real-world fact below comes from responses fetched on 15 Nov 2026 (06:05–06:15 Tashkent) from NASA NTRS
(`ntrs.nasa.gov/api`) and the NASA Image and Video Library (`images-api.nasa.gov`, files on `images-assets.nasa.gov`).
Raw files are in `sources/raw/`: NTRS search JSON `ntrs_*.json`, PDFs `ntrs_<id>.pdf`, image search JSON `search_*.json`,
photos `images/<nasa_id>.jpg`. PDF text in `sources/txt/` and page renders in `sources/pages/` were made locally from
those PDFs. "PDF p." = page in the PDF file, and "printed p." = the number printed on that page.
Photo colours are approximate medians measured from shaded photo regions, so real surfaces are a little lighter.

**Fit to shell** means ASTRA's `buildLander` shell forces the size or position. The NASA value is given next to it.
**No source, kept plain** means no fetched source gives the detail, so it is a plain shape or a layout choice.

## Documents (NTRS)

| key | document | API request that returned it | PDF |
|---|---|---|---|
| **CSI** | *Apollo experience report: Crew station integration. Vol. 1: Crew station design and development* (1976), NTRS **19760011098** | `https://ntrs.nasa.gov/api/citations/search?q=apollo%20experience%20report%20crew%20station&page.size=8` | `https://ntrs.nasa.gov/api/citations/19760011098/downloads/19760011098.pdf` |
| **STR** | *Apollo experience report: Lunar module structural subsystem* (1973), NTRS **19730010174** | `https://ntrs.nasa.gov/api/citations/search?q=apollo%20experience%20report%20lunar%20module%20structural&page.size=8` | `https://ntrs.nasa.gov/api/citations/19730010174/downloads/19730010174.pdf` |
| **FAM** | *Lunar Excursion Module Familiarization Manual* (15 Oct 1965), NTRS **19730060786** | `https://ntrs.nasa.gov/api/citations/search?q=lunar%20module%20familiarization&page.size=8` | `https://ntrs.nasa.gov/api/citations/19730060786/downloads/19730060786.pdf` |
| **ECS** | *Apollo experience report: Lunar module environmental control subsystem* (1972), NTRS **19720013195** | `https://ntrs.nasa.gov/api/citations/search?q=apollo%20experience%20report%20lunar%20module%20environmental%20control&page.size=8` | `https://ntrs.nasa.gov/api/citations/19720013195/downloads/19720013195.pdf` (fetched, only background) |

## Photos (NASA Image and Video Library)

Each photo came from the search request shown, then `https://images-api.nasa.gov/asset/<nasa_id>`, then
`https://images-assets.nasa.gov/image/<nasa_id>/<nasa_id>~medium.jpg`.

| nasa_id | search request | caption (from the API) | what we took from it |
|---|---|---|---|
| `S67-15794` | `https://images-api.nasa.gov/search?q=lunar%20module%20interior&media_type=image` | "Overall interior view of the Lunar Module Mission Simulator" | Overall layout: a centre panel stack between two windows, round instruments in octagonal frames, a keypad console low in the centre, a light-grey hand-controller block with a cream grip at each station, and a grey equipment panel with round ports on the right. Floor grey #757675. |
| `S69-56700` | `https://images-api.nasa.gov/search?q=lunar%20module%20simulator&media_type=image` | "Charles Conrad Jr. (on left), Apollo 12 commander, and Alan L. Bean, lunar module pilot" | The commander stands on the left and the LMP on the right when facing forward. Both stand, with no seats. White stowage bags #D5D7E0 hang on the wall, and a white wall has two big round ports. |
| `as11-36-5389` | `https://images-api.nasa.gov/search?q=lunar%20module%20cabin&media_type=image` | "interior view of the Apollo 11 Lunar Module showing some of the displays and controls" | Grey panels (#484D51–#7F8489), round dials in octagonal frames, small toggles, orange handles and a dark divider beside the window. |
| `as09-23-3595` | same search as above | "Schweickart … inside Lunar Module 'Spider'" | Pale blue-grey panel #6D716F, and breaker rows with small guards. |
| `as11-37-5528` | `https://images-api.nasa.gov/search?q=inside%20the%20lunar%20module%20on%20lunar%20surface&media_type=image` | "Armstrong … taken inside the Lunar Module (LM) while the LM rested on the lunar surface" | Cream perforated wall #C4C1B7, and rows of breaker knobs lit warm orange-red (#9C2E24). |
| `AS17-145-22224` | same search as above | "Cernan … inside the lunar module on the lunar surface" | Cream perforated panel #CCC9C2, black breaker knobs, a white-trimmed stowage net and a window with a padded edge. |
| `as13-62-8929` | `https://images-api.nasa.gov/search?q=lunar%20module%20cabin&media_type=image` | "Interior view of the Apollo 13 Lunar Module (LM) showing the 'mail box'" | Cream equipment wall with two large round ports, a block of white valve knobs and white ribbed hoses. The file may be mirrored. |
| `as11-40-5863` | `https://images-api.nasa.gov/search?q=lunar%20module%20egress&media_type=image` | "Aldrin … egressing the Lunar Module (LM)" | Hatch seen from outside: a squarish opening at cabin floor level with an orange-lined frame. Aldrin crawls out backwards onto a flat porch with thin tubular rails, and the ladder is on the forward leg. |

## Shell (not NASA: ASTRA source, read-only)

| object | value used | source |
|---|---|---|
| ascent cabin | `lm-cabin` lathe, 10 sides, rotated π/10 (a flat facet faces three +z), profile r 1.25@2.78, 1.35@3.0–4.2, 1.15@4.65, 0.75@4.85, 0@4.9 | `src/vendor/astra/scene/models/site.ts` `buildLander` (moon) |
| hatch spot | grey rounded box 0.85 × 1.0 × 0.1 at (0, 3.45, 1.33) and torus r 0.32 at (0, 3.55, 1.39). It is decorative, on the solid +z facet. | site.ts (moon branch). The Mars-branch hatch group at (0, 2.25, 2.3) is not used on the Moon. |
| windows | two panes 0.42 × 0.55 at x ±0.45, y 4.1, z −1.33, facing **−z** (opposite the hatch), tilted 0.12 | site.ts `windowPane` |
| ladder | two rails from (−1.38 ± 0.18, 2.6, 1.38 ± 0.18) down the 135° leg | site.ts ladder (`la = 3π/4`) |
| descent stage top / hazard deck | octagon top y 2.70, dark ring 2.68–2.76, hazard plate 2.82–2.94 | site.ts |

## Object table

| object | value used | NASA value | source |
|---|---|---|---|
| **Forward hatch: shape and width** | square opening, clear width 0.81 m (`HATCH_W` 0.405) | "a square approximately 32 by 32 inches" (0.81 × 0.81 m) | STR PDF p.19 (printed p.15) |
| Forward hatch: height | clear height 0.90 m (sill 3.00, top 3.90). **Fit to shell**: it fills ASTRA's 0.85 × 1.0 m hatch panel. | 32 in (0.81 m) | STR PDF p.19 |
| Forward hatch: opening direction | leaf opens **into the cabin** | "Forward access … was provided by an inward-opening hatch assembly"; "Both hatches open into the LEM; normal cabin pressurization forces the hatches into the seals" | CSI PDF p.26 (printed p.15); FAM PDF p.25 (§2-10) |
| Forward hatch: hinge and latch | hinges on one vertical edge, latch handle on the other edge, on both faces | "Each hatch has hinges on one side and a manually operated single-detent mechanism on the other side"; "Both hatches operable from the interior and exterior of the LM" | STR PDF p.19 and PDF p.6 (requirement 1.c.3) |
| Forward hatch: hinge **side** | hinge on the right as seen from inside facing the hatch (three −x), latch on the left | **Inferred**: in Fig. 20 the T-shaped latch handle sits at the left edge of the leaf seen from inside. The hinge itself is not visible in any fetched source. | CSI PDF p.25 (printed p.14), Fig. 20 "The LM interior – forward hatch" (`sources/pages/crewst_fig20.jpg`) |
| Forward hatch: leaf details | round dump valve in the middle (inside and outside faces), horizontal and vertical stiffening ribs, T-handle | "A cabin-pressure-dump-relief valve is located in each hatch"; valves "designed to be operated from outside as well as inside"; the round valve, ribs and T-handle are seen in Fig. 20 | STR PDF p.19; CSI PDF p.26; CSI Fig. 20 |
| Forward hatch: frame colour | dark frame with an orange lip and an orange jamb | orange-lined hatch frame (photo) | `as11-40-5863` |
| Forward hatch: position | at cabin floor level on ASTRA's +z facet, **opposite** the windows. **Fit to shell**: ASTRA puts its hatch on +z and its windows on −z. | "The ingress/egress forward hatch is on the +Z axis, beneath the center instrument console", in the same front face as the windows | FAM PDF p.25 (§2-10); STR PDF p.17 ("front-face assembly incorporates openings … for two triangular windows and for the egress/ingress hatch") |
| Forward hatch: opening angle | 90° in 1.25 s | no source, kept plain (90° leaves a clear path and clears the furniture) | — |
| **Porch** | flat deck 0.90 × 0.90 m just under the sill (top y 2.98) | "external platform approximately 0.9 meter (3 feet) square, below the forward hatch"; "The forward hatch has an external platform on which the astronauts step" | CSI PDF p.21 (printed p.10); FAM PDF p.25 |
| Porch rails | thin steel tube rails, 0.90 m high | rails seen in the photo; the height has no source and is kept plain | `as11-40-5863` |
| Porch walkway to ladder | short deck from the porch to ASTRA's ladder top. **Fit to shell**: ASTRA's ladder is on the 135° leg, not under the hatch. | "The forward landing gear (+Z axis) has a boarding ladder on the primary strut" | FAM PDF p.27 (§2-12) |
| **Cabin size** | lining: 10-sided, 2.34 m across the flats (apothem 1.17) at floor y 3.00. **Fit to shell**: ASTRA's lathe has r 1.35. | cabin "92 inches in diameter" (2.34 m); "2.3-meter (92 inch) diameter forward cabin section" | STR PDF p.17 (printed p.13); CSI PDF p.21 |
| Cabin height | 1.78 m to the overhead ring at the centre, 1.15 m at the walls before the roof slope. **Fit to shell**: ASTRA's lathe goes y 2.78–4.9. | not in the fetched sources | — |
| Crew compartment volume | not modelled separately | 7 m³ (235 ft³) in total, about two-thirds in the forward cabin and the rest in the 1.4 m (54 in) midsection | CSI PDF p.21 |
| **Two standing crew stations** | CDR on the left and LMP on the right when facing the windows; no seats | the caption says Conrad (commander) is "on left"; both are seen standing | `S69-56700` |
| Restraints | per station, two floor reels, cables up to orange D-ring clips at waist height (stowed) | "restraint cables … attached to waist-high D-rings … A constant-force reel control provided a downward force of approximately 135 newtons (30 pounds)"; "Crewmen restraint cables (stowed)" (Figs. 16, 17) | CSI PDF p.27 (printed p.16); CSI PDF p.24 (printed p.13) |
| **Main panels 1 and 2** | two grey panels in the centre stack, one per station, each with a round "ball" instrument in an octagonal frame, lamps and toggles, **no text** | "Primary displays and controls were situated in the two main display panels, numbers 1 and 2, located directly in front of the CDR and the LMP"; octagonal instrument frames in the photos | CSI PDF p.27; `as11-36-5389`, `S67-15794`; CSI Fig. 15 |
| AOT | dark telescope tube above the centre stack, between the stations | "an alinement optical telescope (AOT) … was provided between the flight stations of the CDR and the LMP" | CSI PDF p.27; FAM PDF p.23 (Fig. 2-3, item 15) |
| DSKY | dark box with a blank green readout and a white keypad on the sloped lower centre console (no digits or labels) | "A DSKY … was located in the panel area directly beneath the AOT" | CSI PDF p.27; CSI Fig. 15 |
| Side panels (circuit breakers) | grey panel outboard of each station, with 4 rows of 10 dark breaker knobs (upper) and toggles and lamps (lower) | "All circuit breakers were installed in the upper side panels located outboard from the CDR and the LMP"; breaker rows in Figs. 16, 17 | CSI PDF p.27; CSI PDF p.24 (Figs. 16, 17); `as11-37-5528`, `AS17-145-22224` |
| **Hand controllers** | per station: an ACA pistol grip (cream) for the right hand and a TTCA for the left hand, each on a light-grey block | "Two three-axis pistol-grip hand controllers"; Fig. 15 labels the "Attitude control assembly" and the "Thrust/translation control assembly"; grey block with cream grip in the photo | CSI PDF p.27; CSI Fig. 15; `S67-15794` (block #BEC0BF, grip #BDAE88) |
| TTCA shape | short T-handle | the shape of the LM TTCA is not described (the CM translation controller is "T-shaped"), so it is kept plain | CSI PDF p.28 (printed p.17) |
| **ECS station** | white box with two large round suit-loop ports, a block of 6 valve knobs and white hoses to the floor, aft of the LMP (right side) | "An ECS station containing suit plumbing outlets, valve controls, and other ECS items was located in the LM midsection area immediately aft of the LMP (fig. 18)"; Fig. 18 "looking aft and left (ECS equipment location)" shows the knob block and round ports | CSI PDF p.27; CSI PDF p.24 Fig. 18; `as13-62-8929`, `S67-15794` |
| **Stowage** | open steel frame with 3 white bags behind dark straps, aft of the CDR (left side) | "Stowage compartments were built into the interior walls … A variety of stowage bags"; Fig. 19 "looking aft and right (stowed equipment area)"; white bags in the photo | CSI PDF p.26; CSI PDF p.25 Fig. 19; `S69-56700` (#D5D7E0) |
| **Overhead (docking) hatch** | round leaf, Ø 0.81 m (r 0.405), grey, with ribs, an orange latch handle, a dump valve and hinge blocks; static (closed) | "The hatch is approximately 32 inches in diameter"; hinged and "rotated into the LM cabin"; ribs seen in Fig. 21 | STR PDF p.19; CSI PDF p.26; CSI PDF p.25 Fig. 21 |
| Overhead hatch position | cabin centre top (y 4.79). **Fit to shell**: under ASTRA's top hatch cylinder at (0, 5.0, 0). | "in the midsection on the +X axis, directly above the ascent-engine cover" | STR PDF p.19; FAM PDF p.25 |
| **Windows** | inner glass and a dark bezel on ASTRA's two rectangular 0.42 × 0.55 panes. **Fit to shell**: ASTRA's panes are rectangular. | two **triangular** forward windows, each "approximately 2 square feet of viewing area" (0.19 m²), "canted down and to the side" | STR PDF p.18; FAM PDF p.25 |
| Overhead docking window | not built: ASTRA's shell has no window there | "An overhead docking window on the left side … directly over the commander's head", about 5 × 12 in | STR PDF p.19; FAM PDF p.25 |
| Window bulkhead | flat grey panel wall carrying the windows and the centre stack | panels are in the forward section (Fig. 15) | CSI PDF p.27; CSI Fig. 15 |
| **Lighting** | two warm floodlight panels on the ceiling plus one over the hatch (`glow_lamp`) | "incandescent lamps were used in the LM" for floodlighting | CSI PDF p.28 (printed p.17) |
| Panel lamps and numerics | small glowing rectangles (`glow_screen` green, `glow_amber` orange), **no text** | "Integral panel and numerics lighting was provided … by electroluminescent (EL) materials"; lit breaker rows glow warm orange in the photo | CSI PDF p.28; `as11-37-5528` |

## Colours (materials)

| material | value used | NASA value (photo median) | source |
|---|---|---|---|
| `int_cream` (lining) | #c4c1b7 | perforated cream wall #C4C1B7 (#CCC9C2 and #B4AEA5 in other photos). The perforation is not modelled because there are no textures. | `as11-37-5528`, `AS17-145-22224`, `as17-134-20530` |
| `int_panel` (panels, bulkhead) | #6d7378 | panel grey #484D51–#7F8489 and #6D716F | `as11-36-5389`, `as09-23-3595` |
| `int_floor` | #757675 | simulator floor grey #757675 (flight-type cabins show tan #846243 and mustard #94550C) | `S67-15794` (alternatives `S69-56700`, `S70-45555`) |
| `int_fabric` (stowage bags) | #d5d7e0 | white stowage bags #D5D7E0 | `S69-56700` |
| `int_orange` (handles, hatch lip, D-rings) | ASTRA orange #ff8a3d | orange handles (#6D3C2C, shaded) and orange-lined hatch frame | `as11-36-5389`, `as11-40-5863` |
| `glow_amber` | ASTRA orange #ff8a3d, emissive | lit breaker panel #9C2E24 | `as11-37-5528` |
| `int_white` (ECS box, hoses, hull patch) | ASTRA white #e8ecf2 | equipment wall #C1C4C6 and white hose #CED1D8 | `as13-62-8929` |
| `int_grey` (hatch leaves, controller blocks) | ASTRA grey #a9b2c0 | controller block #BEC0BF | `S67-15794` |
| `int_dark`, `int_steel`, `int_glass` | ASTRA dark #2a3140, steel #8b94a3, window glass #152238 | no NASA colour used (ASTRA palette) | `common.ts` C, shell `lander_13` |
| `glow_screen` | #3ee39a, emissive | the EL colour was not fetched, so it is kept plain | — |
| `glow_lamp` | warm white #ffe2b0, emissive | the lamp colour was not fetched (only "incandescent"), so it is kept plain | CSI PDF p.28 |

## Not used, and why

- `as13-59-8484` (black and white, rotated), `as14-64-9193`, `S70-45581`, `S69-19981`, `S70-45555`, `as11-36-5390`,
  `as17-134-20530`: these were downloaded and viewed but gave no fact used in the model beyond the colour notes above.
- Apollo Operations Handbook LM vol. 2 (NTRS 19710071423) showed up in a search but was not downloaded.
- The NTRS searches for "lunar module news reference", "lunar module forward hatch" and "LM crew compartment", and the
  image searches for "LM crew compartment" and "DSKY", found nothing usable.
- The "HB7 LANDER" lettering and the hazard-stripe plate belong to ASTRA's shell. Our GLB has no text, logos or flags.
