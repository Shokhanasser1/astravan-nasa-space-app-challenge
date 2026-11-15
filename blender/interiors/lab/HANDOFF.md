# lab (game: Workshop) — round hatch + interior — HANDOFF

Built fully in Blender 5.3 by `build_lab.py` (`Blender -b --factory-startup -P build_lab.py [-- render [shots]]`).
Native ASTRA metres, ASTRA `buildLab` model frame (three: x along the module axis, y up, +z = south/front).
In the game apply the same transform as the shell: `rotation-y={turn}` + `scale={ASTRA_SCALE.lab}` (0.6).
Every NASA fact and its API request: `SOURCES.md`.

## Files
- `build_lab.py` — rebuilds everything from scratch, runs the fit check, writes `walk.json`, `fitcheck.json`, exports.
- `render_lab.py` — Cycles CPU renders (called by `build_lab.py -- render`), 960×540, 32 samples + OIDN denoise.
- `lab_interior.blend` (includes `REF_shell`, not exported), `lab_interior.glb` (raw), `lab_interior.opt.glb` (game).
- `renders/cutaway.webp`, `inside_eye.png`, `door_closed.png`, `door_open.png`.
- `SOURCES.md` (every fact + NASA API URL), `walk.json` (footprints, three coords, native m), `fitcheck.json`.

## What is inside (west → east)
Module inside: x −1.70 … +1.70 (flat end bulkheads), walkway deck y 0.60, flat ceiling y 2.199, curved white lining
r 0.875 (axis y 1.363). Walkway between the cabinet fronts: z −0.33 … +0.33 (0.66 m wide).

1. **Hatch, west end (x −2.06 … −1.70)** — NASA-Docking-System-style round hatch (NTRS 20190030368).
   Outside: grey leaf r 0.40 with an orange three-spoke hand wheel, a round viewport, two grab handles; it hangs on a
   vertical hinge on the north side (two steel knuckles + hinge arm). Steel flange r 0.50 sits 1–2 cm proud of
   ASTRA's dome, dark seal ring, orange band. Collar/tunnel x −1.98 → −1.70, clear bore Ø 0.72 m (centre y 1.363,
   sill y 1.003). Inside: flat west bulkhead with a blue trim ring round the bore, two vertical blue hand rails, a blue
   latch lever and two grab handles on the leaf's inner face, and a grey step (x −1.63 … −1.40, top y 0.82, orange
   edge) up to the sill.
2. **Middle, north wall (−z), x −1.08 … +1.12 — maintenance work station** (ISS Maintenance Work Area look,
   iss063e004863): white floor cabinet with 9 grey tool drawers (orange pulls) and a green status LED; 2.2 m
   dark-blue MWA bench top at y 1.28 with silver hinge strips, white velcro squares and orange clamps; a grey part
   being serviced (open lid, blue cable). Above it on the wall: dark-blue tool board with light-blue squares, chrome
   wrench, screwdriver, cutters, socket rail, two tape rolls (ISS tool kit S106E5259).
3. **Middle, north-east on the bench — 3D printer + robot arm**: printer 0.33 × 0.30 × 0.36 m (ISS "3D Print",
   NTRS 20140011720) at x 0.86, z −0.56, AMF-style front (iss047e152500): framed window, lit chamber, fan grille,
   build plate with a cream ABS part, foam door folded down, feedstock door with strap, green power LED. Robot arm
   `lab_arm` (base at x 0.50, z −0.58; base, two white links, orange joints, gripper) reaching to the printer door
   (FabLab concept, NTRS 20190033333).
4. **Middle, south wall (+z) — stowage**: white cabinet with 8 open cubbies, each holding one single Cargo Transfer
   Bag end-out (0.42 × 0.25 m face, cream, blank blue label patch, dark strap; NTRS 20160002631, iss034e009690);
   grey counter with blue edge, a laptop with a glowing screen, three grey rock samples waiting for the glovebox.
   The lining has two openings with blue reveals (x −0.9 … −0.3 and 0.3 … 0.9) in front of ASTRA's lit south
   windows.
5. **Ceiling (whole length)**: 8 SSLA-style light units (white plate, glowing lens, chrome end handles; iss049e028948)
   in two rows of 4 on the upper walls, and a blue hand rail along each side.
6. **East end (x 1.00 … 1.70) — GeoLab-style sample glovebox** (NTRS 20120007479 / 20100034890): stainless box with
   trapezoid sides and a sloped polycarbonate front, work volume 0.92 W × 0.65 H × 0.52 D m (ISS MSG, NTRS
   19990079845), two Ø 0.25 m dark bolted glove ports with dark gloves, top window with a flat LED panel. Inside: sample
   tray with 3 rocks, stereo microscope, mass balance. Above: two monitors on a post. Below: grey stand with a shelf
   and 3 sample containers. Behind: three Ø 0.25 m pass-through antechambers to the east bulkhead (towards ASTRA's
   outdoor glovebox on the east end).

## Node names (glTF)
```
lab_interior                        root empty, identity, at origin
├─ lab_door                         hatch pivot = vertical hinge line at (-2.06, 1.363, -0.53) three, north side
│  └─ lab_door_leaf                 round leaf r 0.40: hand wheel, viewport, grab handles, inner latch lever
├─ lab_floor                        walkway deck y 0.60 (plates, seams, blue edge strips)
├─ lab_furniture
│  ├─ lab_arm                       arm pivot empty (vertical axis at its base, three (0.50, 1.315, -0.58))
│  │  └─ lab_arm_mesh               robot arm in its rest pose (reaching to the printer)
│  ├─ lab_furniture_static          bench + drawers + tool board, 3D printer, stowage + bags, laptop, glovebox, step
│  ├─ lab_hatch_frame               collar/tunnel (bore r 0.36), flange r 0.50, seal, hinge knuckles, orange band
│  ├─ lab_light_housings_N / _S     white plates + chrome handles of the ceiling lights
│  └─ lab_rails_N / lab_rails_S     blue hand rails along the upper walls
├─ lab_glow                         everything here uses glow_* materials (power on/off)
│  ├─ lab_lights_N / lab_lights_S   8 glowing light lenses (glow_light)
│  └─ lab_glow_parts                monitors, laptop screen, glovebox LED panel, printer chamber light, status LEDs
├─ lab_wall_S / lab_wall_top / lab_wall_N    lining (single-sided, faces inward); S has the 2 window openings
└─ lab_wall_W / lab_wall_E          flat end bulkheads at x = -1.70 / +1.70 (W has the hatch bore, blue trim, rails)
```
For a dollhouse/cutaway view the game can hide `lab_wall_S`, `lab_wall_top`, `lab_lights_S`,
`lab_light_housings_S`, `lab_rails_S` (and the ASTRA shell) — exactly what `renders/cutaway.webp` shows. All opaque
materials are single-sided (`doubleSided: false`), so the lining never blocks a view from outside.

**Robot arm:** `lab_arm` is ready for the Workshop's existing arm motion (`yaw(a, 0.45 * Math.sin(0.8 * t))`, i.e.
rest ±26°): the pivot's rest rotation is identity (the rest pose is baked into the mesh), so the game's
`yaw(node, a)` (yaw about +y times the node's rest quaternion) works on `lab_arm` as it is. Checked in Blender
at −26°, −13°, 0°, +13°, +26°: the arm touches nothing but the bench top under its own base (no hit on the printer,
tool board, lining or shell). Today `Workshop.tsx` only drives a node named `arm` of the old NASA model, so the game
must look up `lab_arm` in our GLB.

## Clip
`DoorOpen` — 24 fps, frames 1→30 (keys at t = 0.0417 … 1.25 s), one channel: `lab_door` rotation, 0 → −105° about
the vertical (three +y) axis, Bezier ease in/out (sampled by the exporter: 30 keys raw, 29 after optimise). Closed at
the start, open at the end; play forward to open, backward to close. The leaf swings outward (−x) toward the north
side; when open the whole Ø 0.72 m bore is clear, and the leaf clears the collar, the skid and ASTRA's cradles
(`renders/door_open.webp`).

## ASTRA shell parts the game must cut (the hatch on `buildLab` is decorative on a solid dome)
In the baked AstraLab geometry (model frame, native metres, before `ASTRA_SCALE`/rotation) **delete every triangle
whose three vertices all satisfy**
`-2.05 <= x <= -1.84` and `sqrt((y - 1.363)^2 + z^2) <= 0.47`
(bounding box: x −2.05…−1.84, y 0.893…1.833, z −0.47…0.47). This removes exactly:
- the hatch group at (−1.9, hy, 0): torus r 0.38, disc r 0.36, 12 bolts, hub ring (steel `#9aa3b4` + grey `#a9b2c0` meshes),
- the hull's dome cap (first lathe band, r < 0.45 at x < −1.88; white `#edf0f3` mesh).
Re-checked on the final build: it removes 80 faces of the hull (`#edf0f3`), 2208 of the steel parts (`#9aa3b4`), 96
of the grey parts (`#a9b2c0`) and nothing else. `render_lab.py` (`cut_shell`) does the same cut for
`renders/door_open.webp`. Our collar (r 0.43) and flange (r 0.50, 1–2 cm proud of the dome) cover the cut edge.
If the cut is not done, the closed leaf still hides ASTRA's hatch (the leaf sits at x −2.04 in front of it), but the
open hatch shows ASTRA's grey disc in the bore.

ASTRA meshes to hide: none inside (ASTRA's lab is empty). ASTRA's own glovebox stays outside at the east end; our
interior glovebox has its three pass-through antechambers on the east bulkhead pointing at it.

## Numbers
| item | value | budget |
|---|---|---|
| triangles (after modifiers; = glTF triangles) | **8,766** | ≤ 22,000 |
| materials | **14**: int_white, int_off, int_grey, int_steel, int_dark, int_blue, int_mwa, int_orange, int_glass, int_bag, int_rock, glow_light, glow_screen, glow_led | ≤ 14 |
| textures | 0 | ≤ 1 (256 px) |
| `lab_interior.glb` (raw) | 372,108 B (372 KB) | — |
| `lab_interior.opt.glb` | **115,076 B (115 KB)** | ≤ 250 KB |
| meshes / primitives (draw calls) | 17 / 45 | — |
| animation | `DoorOpen`, 1 channel → `lab_door` rotation | — |

Triangles per mesh: furniture_static 4,172 · hatch_frame 1,120 · door_leaf 1,116 · wall_W 472 · floor 316 ·
wall_S 288 · arm_mesh 276 · wall_N 216 · light_housings_N/S 144 + 144 · wall_top 96 · glow_parts 96 · rails_N/S 88 + 88 ·
lights_N/S 48 + 48 · wall_E 38.

Optimise (run from `~/dev/astravan-interiors`):
`node_modules/.bin/gltf-transform optimize lab_interior.glb lab_interior.opt.glb --compress meshopt --texture-compress
webp --texture-size 1024 --flatten false --palette false --join-named false --simplify false`.
`--palette false` is required: the default palette step merges the materials into one palette texture. `gltf-transform
inspect lab_interior.opt.glb` (re-run 15 Nov 06:42): 14 materials (glass BLEND + double-sided, all others OPAQUE
single-sided), no textures, `DoorOpen` targets `lab_door` (rotation), node tree unchanged.

## Fit check (mandatory)
`fitcheck.json`: **3,939 interior vertices checked, 0 violations, minimum clearance 3.25 cm** (rule: ≥ 2 cm).
Method (`build_lab.py`, section FIT CHECK): BVHTree of every `REF_shell` mesh (except ASTRA's ground contact-shadow
plane) → nearest-surface distance for every vertex of every exported mesh; plus an inside test against ASTRA's hull
lathe profile (radius × cos(π/40) as a margin for the faceted lathe, |x| < 1.95). Exempt (they sit in/through the hatch
opening by design): `lab_door_leaf`, `lab_hatch_frame`. Extra check on the final build: the arm at ±26° touches no
other mesh except the bench top under its base, and no shell mesh.

## Scale note (native vs NASA)
- Built at ASTRA native metres; the game scales the lab by 0.6. ASTRA's lab is a small module: inside it is 3.40 m
  long (bulkhead to bulkhead), the lining is r 0.875 and the clear height on the walkway is **1.60 m** (deck 0.60 →
  ceiling 2.199).
- Real NASA sizes used 1:1 where they fit: glovebox work volume 0.92 × 0.65 × 0.52 m (MSG 920 × 650 × 500 mm), glove
  ports and antechambers Ø 0.25 m (10 in), 3D printer 0.33 × 0.30 × 0.36 m, CTB faces 0.42 × 0.25 m.
- Fit to shell (NASA value next to it): hatch bore **Ø 0.72 m vs NDS Ø 0.80 m** (ASTRA's hatch disc is r 0.36);
  collar 0.28 m vs the 32″ hatch mock-up's 10″ (0.254 m) tunnel; bench 2.2 m (MWA surface size not found);
  antechambers 0.13 m long; light units 0.50 × 0.13 m (SSLA size not found).
- Game astronaut (1.8 × 0.6 m at native scale): the bore is wide enough (0.72 > 0.6 m) but it is a crawl/duck-through
  hatch, as the real 0.8 m NDS is (NASA's own study calls ~32″ "too small" and recommends 50 × 50″). Inside, the
  astronaut **cannot stand upright: 1.60 m headroom < 1.8 m**. This comes from ASTRA's hull (r 0.96), not from our
  interior; making it taller would break the fit to the shell.
- For the same reason `renders/inside_eye.webp` is taken from y 1.95 (1.35 m above the deck) instead of 1.65 m: an eye
  at 1.65 m above the deck would be above the ceiling.

## Open issues
1. **Headroom**: the game astronaut (1.8 m native) does not fit standing inside (1.60 m) and must duck through the
   Ø 0.72 m hatch. Options for the game: keep the lab a look-in room (cutaway camera, astronaut stops at the hatch),
   or play a crouch pose inside. Not fixable in the GLB without leaving the ASTRA shell.
2. **Shell cut**: the game must delete the ASTRA hatch triangles in the box above; until then the open hatch shows
   ASTRA's grey disc in the bore.
3. **Arm hook-up**: `lab_arm` needs a lookup in `Workshop.tsx` (today it drives a node named `arm`); range ±26° checked.
4. **Glow**: the game should drive the emission of the 3 `glow_*` materials with base power (like ASTRA's `view.glow`).
5. **Not from a NASA source** (kept plain, logged in SOURCES.md): glow_screen blue and glow_light warm tint; orange (ASTRA
   palette) stands in for red clamps/cutter handles; hand wheel, hinge, handles, step and the serviced part are plain
   shapes. NASA sizes not found: MWA work surface, AMF unit, SSLA panel, MSG glove-port diameter → fit to shell.
6. `walk.json` footprints are axis-aligned boxes (yaw 0); the curved lining is approximated by the cabinet boxes and
   the 0.66 m walkway (`walkway_floor`).
7. The renders are from the final model: `cutaway`/`door_closed` came from the 06:26 build and `inside_eye`/`door_open`
   from the 06:27 build of the same script; both `.blend` saves hash identically (geometry, transforms, materials).
