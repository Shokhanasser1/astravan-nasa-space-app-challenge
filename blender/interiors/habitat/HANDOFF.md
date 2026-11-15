# habitat — entrance + interior HANDOFF

Rebuild: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P build_habitat.py`
(then `render_habitat.py` for the renders). Facts and their NASA sources: `SOURCES.md`.

## What is inside (ASTRA native metres; bearings as in ASTRA `sim/home.ts`, 180 = door = three +z)

**Entrance (bearing 180, in ASTRA's link opening)** — a real airlock with two hatches, both the NASA Common Habitat
size: opening 1.016 × 1.524 m (40 × 60 in), sill 0.406 m (16 in step-over), with a small step on each side of each
hatch. Outer hatch in the shell → airlock vestibule (2.3 × ~1.85 m, grated floor, blue handrails, lamp, green status
lamps) → inner hatch → ring hall. Outside: a grated EVA porch with one step down (HDU porch idea: dust falls through).
The game astronaut (1.8 × 0.6 m at native scale) fits: the top of each opening is 1.93 m above the deck
(1.524 + 0.406), the width 1.016 m; feet stay on the deck and step over the sill (NASA CH p3 rule). Checked with rays
in the build (`fit_check.json` → `path_check`, below).

**Ground floor (deck 0.5, ceiling 3.1)**
- core: **storm shelter** — water-wall ring r 1.5–1.9 (5 courses of blue water bags + 3 courses of off-white cargo
  bags), doorway facing the airlock, bench round the north half, ladder up through the 40 × 60 in deck opening.
- 200–295: galley (counter, food warmers, hot/cold water dispenser, lockers) + wardroom table on a locker block,
  4 stools, wall screen.
- 295–335: hygiene, enclosed: toilet room + wash room (basin, lockers, rail), each with its own doorway.
- 335–25: ECLSS — three ISS-rack-size racks (1.05 × 0.86 × 2.01 m) with modules, round tanks, status lamps.
- 25–165: stowage — four open shelves of cargo transfer bags, three big floor bags.

**Upper floor (deck 3.35, ceiling 5.95)**
- core: **command room** (wall r 1.75–1.9, doorway at 180): curved desk, 3 screens, 2 chairs; the ladder comes up
  inside a 42 in (1.067 m) guard rail with a gate.
- 205–25: **four crew quarters**, one behind each small upper window (227.5 / 272.5 / 317.5 / 2.5): bunk with green
  sleeping bag + pillow, padded radiation panel, desk + laptop, locker, door, handrail.
- 25–110: medical corner — bed with raised backrest, wall screen, cabinet.
- 110–200: stowage shelves (cargo bags) and lockers.
- Ring hall round the core on both floors, lit by ceiling panels.

## Nodes (glTF)

```
habitat_interior                 root, identity
  habitat_door                   outer hatch pivot (hinge line, three (-0.568, 1.668, 4.765))
    habitat_door_leaf / _handle0 / _hinge…     (leaf, orange handles both faces, steel rims+hinges)
  habitat_door_inner             inner hatch pivot (three (0.568, 1.668, 3.145))
    habitat_door_inner_leaf / …
  habitat_furniture              static meshes joined per material (int_*)
  habitat_glow                   glow_lamp / glow_screen / glow_status meshes (emissive)
```
Mesh names in the raw GLB say `ground_/upper_/middeck_/roof_` + material; after `optimize` the static ones are
joined per material (names then keep the first one, e.g. `habitat_ground_int_wall` holds both floors).

## Animation

24 fps, frames 1→30 (1.21 s), Bezier ease-in/out, rotation about the vertical axis only, 100°.
- `DoorOpen` — both hatches together (2 channels: `habitat_door`, `habitat_door_inner`).
- `DoorOpenOuter` — only `habitat_door`; `DoorOpenInner` — only `habitat_door_inner` (for an airlock cycle).
Both leaves swing **into the airlock** and end up along its side walls (outer on the −x side, inner on the +x side),
leaving a clear 1.0 m path down the middle. Play forward to open, backward to close.

## Numbers

| | value | limit |
|---|---|---|
| triangles (after modifiers; same count in the optimised GLB) | **26,212** | ≤ 45,000 |
| materials | **13**: `int_wall int_panel int_floor int_steel int_dark int_orange int_blue int_water int_bag int_green glow_lamp glow_screen glow_status` | ≤ 14 |
| `habitat_interior.glb` (raw) | 1,355,320 B (1.36 MB) | — |
| `habitat_interior.opt.glb` | **305,124 B (305 KB)** | ≤ 450 KB |
| meshes | 54 in the raw GLB → 19 after optimize; 24 nodes | — |
| clips | `DoorOpen` (→ `habitat_door` + `habitat_door_inner`), `DoorOpenOuter` (→ `habitat_door`), `DoorOpenInner` (→ `habitat_door_inner`), rotation channels; checked in the optimised file | — |

Optimised with (note `--palette false`: the default palette step merges the 13 named materials into 5
`PaletteMaterial00x` with 2 textures, losing the `int_*` / `glow_*` names the game drives):
`cd ~/dev/astravan-interiors && node_modules/.bin/gltf-transform optimize habitat_interior.glb habitat_interior.opt.glb --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --palette false`

## What the game must hide / cut on ASTRA's habitat shell (three coords, native metres, before ASTRA_SCALE)

ASTRA's shell has **no real opening** at the link (bearing 180): `shellGeometry()` only cuts the windows.
Our outer frame + collar plate sit 1–2 cm proud of the shell there. For the hatch to open into the room, hide or
cut these triangles inside the box **x ∈ [−0.64, 0.64], y ∈ [0.78, 2.56], z ∈ [4.80, 5.45]**:
1. the quilted shell mesh (`shellGeometry`, material `#e7e9ec`);
2. the two restraint-band tori (`BANDS` y = 1.4 and y = 2.4, material `#c9ced6`) where they cross the opening.
(Straps already skip the link opening; the orange band at y 0.75 is behind our collar plate; nothing else of ASTRA
is in the way — confirmed by the path check below, which runs against all 24 ASTRA shell meshes. The collar frame `#a7afbb` at x ±2.07 stays — it frames our door.)
Also hide the old placeholder `Interior()` in `src/scene/parts/Habitat.tsx` when this GLB is shown.
Our lining is double-sided white, so from inside the camera never sees ASTRA's back faces except through windows.

## Fit check

`fit_check.json`, written by `build_habitat.py`:
- **Fit: PASS — 0 violations.** 13,264 interior vertices tested against ASTRA's shell inner surface (BVH ray out from
  the axis; nearest shell point where the ray leaves through a window hole); none closer than 2 cm, minimum clearance
  0.051 m. Exempt as SPEC allows (door parts in the opening): 1,024 vertices of the outer hatch frame, collar plate,
  seal, outside lamp + status lamp, porch, and both hatch leaves.
- **Path: CLEAR.** 105 rays (x −0.3 … +0.3 m, heights 0.55 … 2.30 m = feet on the deck + 1.8 m) along the walk line
  from beyond the porch (three z 6.6) through both open hatches (frame 30) to the ring hall (z 2.2), against all our
  meshes and all 24 ASTRA shell meshes with the cut below applied: nothing in the body band 0.926–2.30 m (the 0.925 m
  row is clear too). Rays at 0.55–0.80 m hit only walk-over parts below the 0.906 m sill top: the lining and the inner
  wall under the two hatch holes, the outer frame's sill, the 0.20 m steps, and outside the collar plate and the shell
  below the cut box.
- Build fix (06:46): `boolean_cut()` read the cutters' `matrix_world` before Blender had evaluated it, so every cutter
  sat at the origin and the ground-floor lining kept no hatch hole and no window holes, the airlock's inner wall kept
  no inner-hatch hole and the middle deck kept no ladder well (that was what blocked the open airlock view). It now
  updates the view layer first; all of these are cut and every render was redone after the fix.

## walk.json

`[{name, x, z, hx, hz, yaw, floor}]`, three coords, native metres, `floor` 0 = ground deck, 1 = upper deck (upper-deck
boxes such as `ustow_locker1` lie right above the airlock in plan, so filter by floor): every partition, the airlock
side walls, the airlock inner wall as two pieces either side of the hatch (`airlock_inner_wall-1/+1`), the hall walls
of the hygiene/crew rooms, the shelter ring (as chord boxes), the command room ring, the guard rail block, ladder,
furniture. The outer lining (r 4.92) is not listed — it is a circle with the outer hatch at bearing 180.
Walk-on parts (not hitboxes): porch three z 5.36–6.11 top y 0.46, lower step z 6.11–6.46 top y 0.24; outer sill
(frame bottom) z 4.84–5.31 top y 0.906; step inside the outer hatch z 4.28–4.60 top y 0.70; inner sill (frame + seal) z 2.85–3.08
top y 0.906 with steps z 3.06–3.36 and 2.54–2.84, top y 0.70; deck y 0.5.

## Open issues

- The hatches keep NASA's 16 in step-over: the game walker has to lift the astronaut over the 0.406 m sills (0.2 m
  steps beside both sills inside; from the porch top to the outer sill it is 0.45 m with no extra step), or simply
  let the feet pass through the sill. There is no hitbox on the sills, steps or porch in `walk.json`.
- Window reveals end at r 5.13; ASTRA's own window glass/glow plates are outside, so through the windows you see
  ASTRA's frame plate, not stars (ASTRA's own design).
- ASTRA's `fabric()` shell material may be single-sided; our lining hides that from inside.
- Hatch swing direction (both into the airlock) is a layout choice, not from a NASA source.
