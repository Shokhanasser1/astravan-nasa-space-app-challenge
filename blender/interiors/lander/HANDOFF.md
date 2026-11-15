# lander (game: Lander) — forward hatch + porch + crew cabin — HANDOFF

Built fully in Blender 5.3 by `build_lander.py`:
`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P build_lander.py [-- --no-render] [-- --only door_open]`
It rebuilds everything from scratch, runs the fit check, and writes `fit_check.json`, `walk.json`, `stats.json` and
`shell_cut.json`. It then exports and renders (Cycles CPU).

The model is in ASTRA's native metres in the `buildLander` (moon) model frame. Three coords: y up, +z = the
lander's front, where ASTRA's hatch is (it faces the hub). In the game, apply the same transform as the shell:
`rotation-y={turn}` + `scale={ASTRA_SCALE.lander}` (0.45). Put the GLB **inside the same group that `Lander.tsx`
moves at lift-off**, so the cabin and porch fly away with the shell on day 7.
Facts and their NASA API sources are in `SOURCES.md`.

## Files
- `build_lander.py` — the single build script (geometry, materials, clip, fit check, walk.json, export, renders).
- `lander_interior.blend`: includes `REF_shell`, which is not exported. After a render run, `REF_shell` shows the game cut applied.
- `lander_interior.glb` (raw) and `lander_interior.opt.glb` (for the game).
- `renders/cutaway.webp`, `inside_eye.webp`, `door_closed.webp`, `door_open.webp` (960×540, Cycles CPU, 32 spp + OIDN).
- `SOURCES.md`, `walk.json`, `fit_check.json`, `shell_cut.json` (what the cut removed), `stats.json`.

## What is inside

The windows are on ASTRA's −z side and the hatch is on its +z side, so inside, the crew faces the windows (−z) with
the hatch behind them. In the real LM the hatch sits below the windows (see Open issues).

**Entrance (+z facet of the cabin)**
- **Forward hatch**: a square opening 0.81 m wide (NASA 32 in) and 0.90 m high, with the sill at cabin floor
  height (y 3.00). The frame is dark with an orange lip, and the jamb is orange. It sits 4 cm proud of ASTRA's
  hatch ring.
- **Leaf**: grey, 0.79 × 0.885 × 0.05 m, hinged on its −x edge and opening **inward** (NASA: both LM hatches open
  into the cabin).
  - Inside face: stiffening ribs, a round dump valve and an orange T-latch handle.
  - Outside face: an orange grab handle and the valve access.
- **Hull patch**: a white plate (ASTRA white) closes the deleted shell facet above the frame. See the cut below.
- **Porch**: a 0.9 × 0.9 m steel deck just below the sill (NASA: "external platform approximately 0.9 m square").
  It has two-level tube rails 0.9 m high. A short walkway runs from the porch to the top of ASTRA's ladder, which is
  on the 135° leg, and our rails continue ASTRA's ladder rails up into grab handles.

**Cabin** (lining 2.34 m across the flats = NASA's 92 in cabin; floor y 3.00; ceiling 1.78 m at the centre)
- Window bulkhead (−z): a grey panel wall with the inner glass and dark bezels of ASTRA's two windows.
- Centre stack between the windows:
  - main panels 1 (CDR) and 2 (LMP), each with a round attitude ball in an octagonal frame, amber lamps, toggles
    and a small green readout;
  - a sloped lower console with the DSKY: a dark box, a blank green readout and a white keypad;
  - the AOT telescope above.
- Two **standing** stations: CDR on the left (x −0.45) and LMP on the right (x +0.45). Each has:
  - an ACA pistol grip for the right hand and a TTCA T-handle for the left hand, on light-grey blocks;
  - two restraint cables from floor reels up to orange waist-high D-rings (shown stowed).
- Side panels outboard of each station: 40 dark circuit-breaker knobs (upper), with toggles and lamps below.
- **ECS station**, aft of the LMP (right side, toward the hatch): a white box with two big round suit-loop ports,
  six valve knobs and white hoses down to the floor.
- **Stowage**, aft of the CDR (left side): an open steel frame holding three white bags behind dark straps.
- Overhead **docking hatch** at the top centre: round, Ø 0.81 m, grey with ribs, an orange latch handle and a dump
  valve. It is static (closed).
- Lights: two warm floodlight panels on the ceiling and one floodlight above the hatch. All text-free.

ASTRA meshes to hide inside: none, because ASTRA's cabin is empty.

## Node names (glTF)

Optimised GLB (`lander_interior.opt.glb`):
```
lander_interior                 root, identity
├─ lander_door                  hatch pivot = vertical hinge line at three (-0.40, 3.005, 1.405)
│  └─ hatch_leaf                leaf (int_grey/steel/dark/orange); meshopt quantisation adds a local T/S here
├─ lander_furniture             static meshes, joined by optimize (names keep the first mesh):
│     bulkhead, bulkhead_cap, cabin_floor, centre_stack, hand_controllers, stowage, windows_inner
└─ lander_glow                  emissive parts for "base power" on/off:
      floodlights (every glow_lamp part, incl. the DSKY's white lamps, + dark housings),
      glow_centre (all other panel lamps/readouts: glow_amber + glow_screen)
```
The raw GLB keeps one node per part:
- under `lander_furniture`: `lining_wall_0…9`, `cabin_floor`, `bulkhead`, `bulkhead_cap`, `windows_inner`,
  `centre_stack`, `hand_controllers`, `restraints`, `side_panels`, `ecs_station`, `stowage`, `overhead_hatch`,
  `hatch_frame` (frame, jamb, sill and hull patch) and `porch`;
- under `lander_glow`: `floodlights`, `glow_centre` and `glow_side`.

For a cutaway or dollhouse view, use the raw GLB and hide `lining_wall_*` and the shell. All opaque materials are
single-sided (`doubleSided: false`; only `int_glass` is double-sided), and the lining faces inward, so from outside
it never hides the shell.

## Clip

`DoorOpen` runs at 24 fps over frames 1→30. Its key times are 0.042–1.25 s, so it lasts 1.21 s.
- It has one channel: the `lander_door` **rotation**, which goes from 0 to **+90° about three +y**.
- The ease is Blender Bezier in/out, sampled by the exporter: 30 keys raw, 28 after optimize.
- The door is closed at the start and open at the end. Play it forward to open and backward to close.
- The leaf swings into the cabin (−z) and ends up along the −x side of the aft floor, leaving the 0.81 m opening
  and the floor in front of it clear.

## ASTRA shell parts the game must cut (the moon hatch is decorative on a solid facet)

In the baked AstraLander geometry (model frame, native metres, before `ASTRA_SCALE` and rotation), **delete every
triangle whose three vertices all lie inside this box**:

**x ∈ [−0.43, 0.43], y ∈ [2.945, 4.21], z ∈ [1.27, 1.45]**

This removes exactly the following, checked on `ref/lander_shell.blend` (results in `shell_cut.json`):

| ASTRA part (site.ts `buildLander`, moon) | material | triangles removed | their bbox (three) |
|---|---|---|---|
| `lathe(g, "lm-cabin", …)`: the +z facet of the band y 3.0–4.2 | white `#e8ecf2` | 2 of 120 | x ±0.417, y 3.0–4.2, z 1.284 |
| `rbox(g, 0.85, 1.0, 0.1, 0.08, grey, 0, 3.45, 1.33)`: the hatch panel | grey `#a9b2c0` | 588 of 588 (all) | x ±0.425, y 2.95–3.95, z 1.28–1.38 |
| `torus(g, 0.32, 0.04, frame, 0, 3.55, 1.39)`: the hatch ring | frame `#9aa3b4` (merged mesh) | 960 of 1756 | x ±0.36, y 3.19–3.91, z 1.352–1.428 |

Nothing else is touched. 14 other lathe triangles have one or two vertices in the box, and they stay.

The same rule runs in `build_lander.py` before the door renders, so `renders/door_closed.webp` and
`renders/door_open.webp` show exactly the game result. Our GLB closes the hole left by the deleted facet
(x ±0.417, y 3.0–4.2):
- the jamb's outer faces sit at x ±0.417;
- the frame covers x ±0.475 and y 2.98–3.975 in front;
- the white hull patch covers x ±0.417, y 3.912–4.20, z 1.288–1.302.

If the cut is **not** done:
- the closed leaf (z 1.405–1.455) still hides ASTRA's panel from the front;
- but the opening leaf passes through the hull facet, and the open doorway shows ASTRA's grey panel.

## Numbers

| | value | budget |
|---|---|---|
| triangles (after modifiers; same in raw and opt GLB) | **6,516** | ≤ 22k |
| materials | **13**: `int_white, int_cream, int_panel, int_grey, int_dark, int_steel, int_floor, int_fabric, int_orange, int_glass, glow_screen, glow_lamp, glow_amber` (Principled only, 0 textures) | ≤ 14 |
| raw GLB | 368,132 B (**368.1 KB**) | — |
| optimised GLB | 92,960 B (**93.0 KB**) | ≤ 250 KB |
| nodes in the raw GLB | 31 (4 empties + 27 meshes; `stats.json` counts the 30 under the root) | — |

Optimise command: the SPEC command **plus `--palette false`**:
```
cd ~/dev/astravan-interiors && node_modules/.bin/gltf-transform optimize lander_interior.glb lander_interior.opt.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --palette false
```
Without `--palette false`, gltf-transform 4.5.1 merges the 13 materials into 6 textured `PaletteMaterial00x`
entries. That loses the `int_*`/`glow_*` names the game needs for power on/off, and the file comes out at 85.2 KB.
`gltf-transform inspect` on the shipped file shows 13 named materials, no textures, and `DoorOpen` →
`lander_door.rotation`.

## Fit check (mandatory) — 0 violations

`fit_check.json`, computed in `build_lander.py` against the appended `REF_shell`:

| test | vertices | violations | note |
|---|---|---|---|
| interior inside the cabin lathe and ≥ 2 cm from every shell surface | 3,359 | **0** | min clearance 3.09 cm; analytic 10-gon test + BVH nearest |
| porch outside the cabin and ≥ 5 mm from every shell surface | 384 | **0** | min 5.8 mm (rail joint on ASTRA's ladder, by design) |
| door parts exempt | `hatch_frame` (frame, jamb, sill, hull patch), `hatch_leaf` | — | they sit in the cut opening |
| door swing: leaf vs. all other interior meshes | frames 1/10/20/30 | no contact | min distance 15.8 / 1.0 / 5.9 / 3.5 cm |

## Scale note (native vs NASA vs game astronaut)

The hatch opening is 0.81 × 0.90 m at native scale.
- **Width**: kept at NASA's 32 in (0.81 m).
- **Height**: 0.90 m, close to NASA's 32 in (0.81 m) and set to fill ASTRA's 0.85 × 1.0 m hatch panel.

ASTRA's whole vertical cabin wall is only 1.2 m tall (y 3.0–4.2), so a hatch the height of a standing 1.8 m
astronaut is impossible on this shell.
- The game astronaut (1.8 × 0.6 m at native scale) fits the **width** (0.6 < 0.81).
- He must **crouch or crawl** to fit the height. That is what real LM crews did: in `as11-40-5863` Aldrin backs out
  on his knees, feet first, onto the porch.
- The cabin headroom at the centre is 1.78 m.

## walk.json

`[{name, x, z, hx, hz, yaw}]` in three coords and native metres; `yaw` is rotation about +y in radians. It contains:
- nine lining wall chords (`wall_0…9`; `wall_7` is the hatch facet, which is the doorway, so it is left out);
- the window `bulkhead`, `centre_stack`, `side_panel_L/R`, `ecs_station`, `stowage`;
- `porch_deck` and `porch_walkway`.
The cabin floor is the 10-gon with apothem 1.17 at y 3.00, and the porch top is at y 2.98.

## Open issues

- **Hatch position vs the real LM**: the real forward hatch is "beneath the center instrument console", in the
  same face as the windows. ASTRA's shell has its hatch on +z and its windows on −z, so ours is behind the crew.
  This is fit to shell, as written in SOURCES.
- **Hinge side** (right as seen from inside, three −x) is inferred from NTRS 19760011098 Fig. 20, where the latch
  handle is on the left of the leaf. No fetched text states it, and the 90° opening angle has no source.
- **Passing the hatch**: the 0.90 m height means the game needs a crouch or crawl, a fade, or a short teleport
  through the hatch.
- **Ladder**: ASTRA's ladder is on the 135° leg, not under the hatch, so our walkway bridges the gap. Our rail
  extensions start 8 mm above ASTRA's strut ends, which is 3.6 mm at game scale and invisible.
- **Windows**: ASTRA's windows are rectangular and ours follow them. NASA's are triangular. The LM's overhead
  docking window is not built, because the shell has none.
- **Static parts**: the overhead docking hatch is static (no clip). The lining is flat cream, without the real
  perforations, because there are no textures.
- **Optimised GLB**: after optimize, `hatch_leaf` carries a quantisation translate/scale under the pivot. That is
  harmless, but animate only `lander_door`.
- **Cutaway render**: the hull patch is seen standing alone above the frame, because the shell is hidden there.
  In the game it lies flush on the shell, as `door_closed.png` shows.
