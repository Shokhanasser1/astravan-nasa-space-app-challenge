# greenhouse (game: Garden) — east-end hatch + interior — HANDOFF

Built fully in Blender 5.3 by `build_greenhouse.py`
(`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P build_greenhouse.py [-- --render]`).
Native ASTRA metres, ASTRA `buildGreenhouse` model frame (three: x along the glazing axis, y up, +z = front/south;
the hatch is on the east end, +x). In the game apply the same transform as the shell: `rotation-y={turn}` +
`scale={ASTRA_SCALE.greenhouse}` (0.45). Every NASA fact and its API request: `SOURCES.md`.

## Files
- `build_greenhouse.py` — rebuilds everything from scratch: geometry, `DoorOpen`, the ASTRA hide/cut rule on the
  reference shell, the fit check (`fit_check.json`), `walk.json`, the .blend, the raw GLB, and with `-- --render` the
  Cycles CPU renders (960×540, 32 samples + denoise; `--only=cutaway,inside_eye,...` for a subset).
- `greenhouse_interior.blend` — includes `REF_shell` (not exported). It shows the shell as the game should after the
  hide/cut rule below (hidden ASTRA meshes are hidden, cut faces are deleted, east cap rebuilt with the doorway hole).
- `greenhouse_interior.glb` (raw), `greenhouse_interior.opt.glb` (game), made with
  `cd ~/dev/astravan-interiors && node_modules/.bin/gltf-transform optimize greenhouse_interior.glb greenhouse_interior.opt.glb --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --palette false`.
  **`--palette false` is needed**: the default palette step merges the flat materials into one palette material and the
  14 `int_*`/`glow_*` materials are lost.
- `renders/cutaway.webp`, `inside_eye.png`, `door_closed.png`, `door_open.png` (+ extras `inside_low.png` kneeling
  height, `door_open_side.png` 3/4 view of the open hatch).
- `SOURCES.md`, `walk.json` (footprints, three coords, native m), `fit_check.json`.

## What is inside (west → east; "north" = three −z, "south" = three +z)
Floor = ASTRA deck top, three y 0.232. The intended arch (ribs) has a clear radius of 1.475 about the axis at y 0.213,
so the room is 1.46 m tall on the centre line (see "Scale note").

1. **West end, x −2.155 … −1.76 — environment + nutrient station** across the full width (z −0.62 … +0.62).
   North half: white control cabinet (to y 1.20) with door outline, orange latch, a dark screen with three glowing
   status squares (green / white / magenta, no text), fan grille with a 5-blade fan (`greenhouse_fan`). South half:
   nutrient bay — blue reservoir tank with a sight glass, pump, orange valves, blue supply lines to both racks, a
   shelf with a seed-starter box of 9 plugs with sprouts (Plant Atrium practice), and a steel duct collar on the back
   wall at (−2.13, 0.95, +0.30) where ASTRA's environmental-unit pipe comes through the west cap.
2. **Two grow racks, x −1.70 … 1.08, |z| 0.355 … 0.925** (one north, one south), 2 tiers each, 2 rows × 6 trays per
   tier = 48 trays. Each tray is the NASA Plant Atrium tray (0.445 × 0.267 × 0.105 m, white) with growth media, 8 pot
   rims, a centre insert with an orange float stick, and a drip line.
   - South rack, lower tier — leafy greens, mature at the west end to young at the door: green butterhead,
     'Outredgeous' red romaine, mizuna, young rosettes.
   - North rack, lower tier — 'Red Robin' dwarf tomatoes on white stakes (fruiting at the west end, young near the door).
   - Upper tiers (both racks) — nursery: young rosettes and seedlings.
   - Light: 2 magenta red+blue LED bars under each upper shelf (`glow_grow`, the game's grow colour #ff6fd8) and 3 flat
     white LED panels over each upper tier (`glow_white`) — the 2011 and 2012 Plant Atrium lights.
   - Water: blue supply header per tier, dark drip line to every tray, risers from the station, white return drain
     under the lower shelves. One white sensor pod with a green light per rack (x 0.17).
3. **Walkway**, x −1.76 … 2.06, 0.66 m wide: dark deck plate with steel slats.
4. **East end — submarine-style hatch** (NTRS 20080018968 Fig. 7, scaled to the shell): white frame ring (coaming)
   through the cap plane, x 2.12 … 2.38 (outer face 2 cm proud of ASTRA's old door panel face 2.36); clear opening a
   stadium 0.80 m wide × 1.27 m tall (sill y 0.25, top y 1.52); dark seal on the inside face; two hinge barrels on the
   north side; orange grab bars outside on both sides. Leaf: white stadium 0.88 × 1.30 × 0.05 m with a round view port
   at the top, steel cross stiffeners on the inner face, orange lever handles on both faces. Inside above the
   opening: a green status lamp and two small white lamps.

No airlock vestibule: NASA's 2-crew airlock (same paper) does not fit in a 4.4 m × 1.5 m half-cylinder without
losing the grow room, so it is one pressure-assisted hatch that opens inward.

## Node names (glTF)
```
greenhouse_interior                 root empty, identity, at origin
├─ greenhouse_door                  hatch pivot = vertical hinge line at three (2.063, *, -0.47), north side
│  └─ greenhouse_door_leaf_*        leaf meshes per material (white, steel, orange, window)
├─ greenhouse_furniture             static meshes per group + material (racks, trays, irrigation, leds, walkway,
│  │                                env station, doorframe)
│  ├─ greenhouse_fan                fan pivot at three (-1.748, 1.06, -0.27); spin about its local x (= three +x)
│  │  └─ greenhouse_fan_blades_*
│  └─ greenhouse_plants
│     ├─ greenhouse_plants_seedling
│     ├─ greenhouse_plants_young
│     ├─ greenhouse_plants_mature
│     └─ greenhouse_plants_fruit    (tomatoes)
└─ greenhouse_glow                  every glow_* mesh: grow bars, white panels, screen squares, sensor lights, door lamps
```
After `optimize` the static meshes under one parent are joined per material and keep the first mesh's name (e.g.
`greenhouse_doorframe_dark` then holds every dark furniture part); all the nodes above keep their names.
Ideas for the game (not required): drive `greenhouse_glow` with `on` (like ASTRA's `setPower`); spin
`greenhouse_fan` like ASTRA's own fan (`useSpin`); show the four plant stage groups by the Garden's `plant` level.
Glow materials are exported with emission strength 1.0. All 14 materials are `doubleSided`.

## Clip
`DoorOpen` — 24 fps, frames 1→31 (keys at t = 0.0417 … 1.2917 s, 1.25 s long), one channel: `greenhouse_door`
rotation, 0 → −90° about the vertical (three +y) axis, Bezier ease in/out (sampled by the exporter: 31 keys raw, 30
after optimise). Closed at the start, open at the end; play forward to open, backward to close. The leaf swings
**inward** (pressure-assisted hatch, it seats on its seal from the pressurised side) toward the north side and ends
flat along the north edge of the walkway (x 1.16 … 2.04, z ≈ −0.42), 8 cm clear of the rack ends (x 1.08)
(`renders/door_open.webp`). The fit check found 0 leaf vertices in the racks or outside the arch at the open pose.

## ASTRA meshes the game must hide, and shell triangles to cut
Our GLB **replaces** ASTRA's interior (its 2 troughs, media, rack legs, irrigation pipes, LED bars, struts and plants
would sit inside our racks), and ASTRA's door panel sits inside our frame tunnel and would block the doorway.

**Preferred: change the source** (`src/vendor/astra/scene/models/life.ts`, `buildGreenhouse`) when our GLB is shown:
1. Skip lines 226–229 — the old door panel: white rbox, dark rbox, steel handle, `GROW-1` label
   (bounding box x 2.17 … 2.40, y 0.21 … 1.54, z −0.46 … 0.46).
2. Skip lines 245–272 — troughs, media, rack legs, irrigation, LED bars + lamps, struts, plants
   (bounding box x −2.01 … 2.00, y 0.21 … 1.66, z −0.92 … 0.92).
3. Line 244, the environmental-unit pipe: end it at the west cap instead of 0.3 m inside, e.g.
   `pipe(g, [[-2.3, 0.85, 0.3], [-2.25, 0.885, 0.3], [-2.2, 0.92, 0.3]], 0.03, steel, 6)`. Its inside part
   (x −2.2 … −1.89, y 0.88 … 1.14, z 0.27 … 0.33) would otherwise go through our nutrient-bay wall, shelf and seed box.
   Our duct collar on the bay wall marks where it comes in.
4. East cap glass (lines 218–224, the `sx = 1` cap): the doorway passes through it. Give the east cap a hole that hides
   inside our frame ring — same half disc, hole = stadium half-width 0.45, bottom arc centre y 0.65, top arc centre
   y 1.12, cut flat at y 0.236 (local y below = world y − y0):
   ```ts
   const doorCap = () => {
     const s = new THREE.Shape().moveTo(R, 0).absarc(0, 0, R, 0, Math.PI, false).lineTo(R, 0);
     const a = 0.45, yb = 0.65 - y0, yt = 1.12 - y0, yc = 0.236 - y0, t = Math.asin((yb - yc) / a);
     const h = new THREE.Path().moveTo(a, yt).absarc(0, yt, a, 0, Math.PI, false).lineTo(-a, yb)
       .absarc(0, yb, a, Math.PI, Math.PI + t, false).lineTo(a * Math.cos(t), yc)
       .absarc(0, yb, a, 2 * Math.PI - t, 2 * Math.PI, false).lineTo(a, yt);
     s.holes.push(h);
     return new THREE.ShapeGeometry(s, 32);
   };
   // for sx === 1 use geo("gh-cap-door", doorCap) instead of the CircleGeometry
   ```
   This exact outline is what `build_greenhouse.py` builds for the renders (ray test: the doorway is open, glass all
   round it), but the TypeScript above was not run in the game. Simplest fallback: hide the east cap glass entirely
   (the 32 triangles of the `#dff3ff` glass whose vertices all lie at x = 2.2); it is 16 % opaque, so this is barely
   visible.

**Fallback without source changes** (the baked group merges materials, so match by box + colour): in the baked
AstraGreenhouse geometry (model frame, native metres, before `ASTRA_SCALE`/rotation) delete every triangle whose
centroid lies in
- box A: x −2.2 … 2.05, y 0.24 … 1.70, z −0.95 … 0.95, or
- box B: x 2.17 … 2.40, y 0.21 … 1.54, z −0.46 … 0.46,

**except** triangles of the glass (`#dff3ff`, transparent) and of the rib/stringer/cap-frame metal `frameMat`
(`#d5dae2`). Tested on the ASTRA dump (`ref/greenhouse_shell.blend`): it removes all of the door panel (`#e8ecf2`,
588), the label (2), troughs `#e6e9ef` (1176), media (24), irrigation `#2b2f37` (320), LED lamps `#ffb8ea` (192), all
plant/stake/stem/tomato parts (12 060); 1764 of 1820 `#2a3140` triangles (keeps only the status-lamp base) and 1002
of 1168 `#9aa3b4` steel triangles (keeps the pipe outside the west cap and 16 rack-leg bottom triangles lying flat on
the deck, never visible) — and nothing else. Then handle the east cap as in step 4.

Kept as they are: glazing, ribs, stringers, west cap, skid/deck, the west environmental unit outside, the status lamp
above the east end (x 2.3, y 1.6, z 0.65 — 20 cm clear of our frame).

**ASTRA glazing bug (reported, not changed):** `life.ts` line 210 builds the glazing half-cylinder on the front (+z)
side from y −1.29 (1.5 m below the deck) to y 1.71, instead of an arch over the top — the back upper quarter has no
glass and the front lower quarter pokes through the deck and the ground. Fix: `thetaStart` `-Math.PI / 2` → `0`.
Our interior is fitted to the intended arch (ribs/stringers), so it fits either way.

## Numbers
| | value | limit |
|---|---|---|
| triangles | 19 128 (Blender, after modifiers); 19 090 in the opt GLB | ≤ 22 000 |
| materials | 14: `int_white`, `int_steel`, `int_dark`, `int_window`, `int_media`, `int_leaf`, `int_leaf_light`, `int_leaf_red`, `int_tomato`, `int_orange`, `int_blue`, `glow_grow`, `glow_white`, `glow_status` (Principled, no textures) | ≤ 14 |
| raw GLB | 795.8 KB (795 768 B) | — |
| opt GLB | 194.6 KB (194 624 B), meshopt + `KHR_mesh_quantization` (the loader needs the meshopt decoder) | ≤ 250 KB |
| clip | `DoorOpen`, 1 channel, 30 keys, 1.25 s | 1.0–1.5 s |

## Fit check (mandatory) — `fit_check.json`
**0 violations outside the door parts.** 17 144 vertices tested (every exported mesh except the hatch frame ring and
leaf, which sit in the opening by design):
1. analytic envelope of the intended arch: r ≤ 1.455 about the axis (rib inner edge 1.475 − 2 cm), |x| ≤ 2.16 (cap
   frame bars 2.18 − 2 cm), nothing below the deck top → 0 outside;
2. BVH nearest distance ≥ 2 cm to every ASTRA shell mesh that stays in the game after the hide/cut rule above (deck,
   skid and contact shadow left out because the furniture stands on the deck) → 0 closer than 2 cm. Minimum
   clearance 4.35 cm (rack steel to the ribs/stringers).

Door parts (740 vertices): 8.8 cm minimum to ribs, stringers, cap frame bars and the status lamp; they pass through
the east cap glass by design (the hole in step 4). Open pose (frame 31): 0 leaf vertices in the racks or outside the
arch.

## Scale note (native vs NASA)
The shell sets the size. The arch is 1.46 m tall above the deck on the centre line, so NASA's 0.86 × 1.83 m submarine
hatch cannot fit. The opening keeps NASA's stadium shape, scaled down so the frame ring stays 8.8 cm off the ribs:
**0.80 × 1.27 m clear** (sill 1.8 cm above the deck). The game astronaut (1.8 × 0.6 m at native scale) fits the width
but not the height: it cannot walk upright through the hatch or stand inside at native scale (NASA's walk-through
hatch is 1.83 m tall). The game has to crouch/shrink the astronaut or keep the camera outside. The `inside_eye.png`
camera is therefore at 1.32 m above the deck, not 1.65 m (1.65 m would be outside the glazing).

## walk.json
`[{name, x, z, hx, hz, yaw}]`, three coords, native metres, all `yaw` 0: both racks, the environment station, the two
sides of the door frame, the open-leaf position, the east cap on both sides of the door, the west cap, and the
glazing along both sides (as boxes at |z| 1.45).

## Open issues
- Height: see "Scale note" — the astronaut does not fit upright at native scale (shell limit, not ours).
- The ASTRA hide/cut and the east-cap hole have to be done in game code; the TypeScript snippet is untested in the game.
- ASTRA glazing bug (line 210) is reported only; the fix is a one-word change in vendor code.
- Not from a NASA source (kept plain, fit to shell): rack frame sizes, walkway, station cabinet and tank sizes, the
  layout of crops by rack/tier, and the inward-north swing side. No Prototype Lunar Greenhouse (U. Arizona) data was
  found through the NTRS / Image APIs, so nothing of its cable-culture layout is used.
