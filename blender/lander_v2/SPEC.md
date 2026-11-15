# Lander v2 — shared spec (15 Nov 2026, local only, NOT for the repo)

A new, detailed lunar lander built procedurally in Blender 5.3 (Python, `-b --factory-startup`), matching the
team's concept images (described below — the images are not on disk). Exterior + walk-in interior + moving parts +
astronaut animations (climb the ladder, press buttons, enter the hatch) + the "step 5" still: the astronaut seen
from behind on the Moon, the lander standing a little askew to the right, a tiny Earth in the black sky, footprints
— Houston says "Return in seven days".

Everything in this file is a CONTRACT between four parallel workers. Do not change a number here on your own; if one
does not work, use the closest thing that does and say so in your report.

## Units and axes
Metres. Blender Z up. The lander's FRONT (hatch, porch, ladder) faces −Y. Origin = ground under the centre of the
lander; footpad bottoms at z = 0. Root empty `Lander` at the origin (scenes tilt/turn this one).
Two child empties keep the team names: `lander_base` (descent stage, legs, porch, ladder — stays on the Moon) and
`lander_body` (ascent stage cabin, interior, antennas, arm — lifts off on Day 7). Everything is parented under one
of them (directly or through part pivots).

## The concept image (what it looks like)
Apollo-LM-like but cleaner and more "designed":
- Descent stage: an octagonal box wrapped in crinkled GOLD foil (Kapton look: strong crumple bump, specular
  highlights, slightly darker in the creases), dark engine bell underneath, small grey details (RCS 4-nozzle crosses,
  boxes, struts) on its faces.
- Four landing legs (front/back/left/right): the main strut gold-foil wrapped, a silver lower piston, two thin silver
  secondary struts per leg forming an A-frame back to the lower body, shallow round gold/brass footpad bowls.
- Front: a flat grey porch with thin tubular handrails, and an aluminium ladder down the front leg.
- Ascent stage (cabin): WHITE painted aluminium with light grime, a faceted octagonal "helmet" shape — vertical
  faces, chamfered corners, chamfered roof edges. Front face: a rounded-square hatch door with a small window and a
  handle, a strip of small sensors above it, a small control panel with a red/green lamp to the left of the door.
  Two dark trapezoid windows with gold-edged frames on the upper front-left and front-right facets.
  Top: a short cylindrical docking tunnel, 2-3 thin whip antennas, a small white dish antenna on a mast (front-left).
  RCS 4-nozzle thruster crosses on the cabin's upper corners.
- LEFT side (−X): a big parabolic wire-MESH antenna, ~2.2 m, 12-sided rim, radial ribs, gold mesh, on a boom.
- RIGHT side (+X): a white robotic arm (shoulder, long upper arm rising up and out, elbow high, forearm hanging
  down, wrist, three-claw gripper) and, behind it, a round white/gold umbrella mesh dish ~1.6 m.
- Lighting in the concept: hard low sun, black sky, grey regolith with rocks.

## Dimensions (all world coordinates, lander upright)
Descent stage (`lander_base`)
- Body: regular octagon prism, across flats 3.8 m (flats face ±X, ±Y and the diagonals), z 1.30 … 2.95.
  Top deck at z = 2.95.
- Engine bell: under the centre, z 0.80 … 1.30, exit radius 0.62, throat radius 0.30.
- Legs at azimuth front (−Y), right (+X), back (+Y), left (−X). Footpad centre at radius 3.70 from the centre axis,
  pad bottom z = 0, pad bowl diameter 0.90, height 0.18. Main strut from the body at radius 1.95, z 2.75 down to the
  pad top (radius 3.70, z 0.18). Secondary struts: from the main strut at about radius 3.0 / z 0.95 back to the
  body's bottom edge at radius 1.95, z 1.35, ±0.90 sideways.
- Porch: top surface z = 2.98, x −0.60 … 0.60, y −2.45 … −1.55, thickness 0.06. Handrails: tubes 0.035 m at
  x = ±0.62 from y −2.45 to −1.60, 0.90 m above the porch.

Ladder (on `lander_base`) — the climbing animation is built on these exact numbers
- Centre plane x = 0. Rails: round tubes 0.05 m at x = ±0.24. Rungs: round bars 0.035 m diameter between the rails.
- 8 rungs, i = 0..7: centre z_i = 0.70 + 0.30·i (0.70 … 2.80), y_i = −2.45 − (2.95 − z_i)·tan(28°)
  (the ladder leans out 28° from vertical at the bottom). So rung 0 = (0, −3.646, 0.70), rung 7 = (0, −2.530, 2.80).
- Rails run from z 0.45 (bracket to the front leg near the pad) up past the porch edge and continue as grab handles
  0.85 m above the porch (z ≈ 3.83), bending inward over the porch edge. Brackets tie the ladder to the front main strut.
- A climber faces +Y (toward the lander), hands on the rails, boots on the rungs (ball of the foot on the rung top,
  rung top = z_i + 0.0175).

Ascent stage cabin (`lander_body`)
- Outer: faceted octagon in plan, x −1.45 … 1.45, y −1.55 … 1.35, corner chamfers 0.55; walls vertical from z 2.95
  to 5.05, then the roof edges chamfer inward 0.40 to a flat roof at z 5.45.
- Front face plane y = −1.55 (x −0.90 … 0.90 is the flat front).
- Hatch opening on the front face: 0.90 wide × 1.40 tall, x −0.45 … 0.45, bottom (sill) z 3.00, top z 4.40.
- Hatch door: rounded rectangle (corner radius 0.12), 0.06 thick, small window 0.30 × 0.22 in its upper half, a
  handle on its right side (+X) at z 3.75 on both faces. Hinge = vertical axis on the door's −X edge.
  Empty `hatch_pivot` at (−0.45, −1.55, 3.00), door mesh `hatch_door` parented to it. Door opens INWARD:
  rotation_euler.z from 0 (closed) to +100° (open).
- Exterior hatch button `btn_hatch_ext`: face centre (−0.72, −1.565, 3.95), press direction +Y, travel 0.012 m;
  lamp `lamp_hatch_ext` just above it (red = locked, green = open).
- Front windows: trapezoids ~0.55 wide × 0.50 tall on the front-left and front-right chamfer facets, z 4.55 … 5.05.
- Top: docking tunnel cylinder r 0.42, z 5.45 … 5.75; 2-3 whip antennas 1.0-1.5 m; small dish 0.5 m on a 0.4 m mast
  at the roof's front-left.
- Big mesh antenna (left): `antenna_big_pivot` on a boom from the cabin's −X side at z 4.2 (boom ~0.9 m), dish 2.2 m,
  facing −X and a little forward/up.
- Round dish (right, behind the arm): `antenna_small_pivot` at about (+1.6, +0.6, 4.4), dish 1.6 m, facing +X / up.
- Robotic arm (right): pivots (empties, mesh children) `arm_base` (yaw, Z) at (1.35, −1.20, 2.95) on the deck corner,
  `arm_shoulder` (pitch), upper arm ~1.6 m rising up and out, `arm_elbow` high at about z 4.9, forearm ~1.4 m
  hanging down and out, `arm_wrist`, gripper with `arm_finger_1`, `arm_finger_2`, `arm_finger_3`. White with grey joints.

Interior (inside `lander_body`, collection `LI_interior`)
- Floor z 3.00 (flush with the hatch sill and the porch), ceiling z 5.20. Inner walls follow the cabin facets
  0.15 m inside the outer skin: x −1.30 … 1.30, y −1.40 … 1.20, chamfers 0.50. The hatch opening cuts through the front
  wall (y −1.55 … −1.40). Overhead docking hatch in the ceiling (r 0.40) with handholds.
- MAIN INSTRUMENT PANEL on the back wall: a plane through C = (0, 1.15, 4.35) facing into the cabin with normal
  n = (0, −0.966, 0.259) (top leans back 15°), 1.60 wide (x −0.80 … 0.80), 1.00 tall along the panel
  (panel-up direction U = (0, 0.259, 0.966)). Two screens, gauges, rows of toggle switches and small buttons.
- HERO BUTTONS (the animation presses exactly these; face centres, press direction = −n, travel 0.012 m):
    `btn_main_1` (−0.30, 1.0967, 4.2090)
    `btn_main_2` ( 0.00, 1.0967, 4.2090)
    `btn_main_3` ( 0.30, 1.0967, 4.2090)
    `btn_launch` ( 0.00, 1.0372, 3.9869)  larger, red, under a flip cover `btn_launch_cover` (hinge on its top edge)
- Side consoles on the left and right walls, z 3.90 … 4.70, switch arrays; `btn_side_L` face (−1.285, 0.20, 4.30)
  faces the cabin (+X), press direction −X (into the wall); `btn_side_R` face (1.285, 0.20, 4.30) faces −X,
  press direction +X.
- Interior hatch button `btn_hatch_int` face (−0.70, −1.385, 3.95), press into the wall (−Y).
- Standing spot at the main panel: (0, 0.50, 3.00), facing +Y. Keep r 0.5 m around it clear.
- Lighting: warm-white ceiling light strips (emissive) + 1-2 area lights; screens and lamps emissive.

## Moving parts and their Blender actions (made by the part's owner)
Each animated part is an Empty pivot with the mesh as a child. Actions (fake user, 30 fps):
- exterior: `HatchOpen` (hatch_pivot rot z 0 → 100°, 2.0 s, ease-in-out), `HatchClose` (reverse);
  `ArmIdle` (slow 6 s loop of the arm joints), `AntennaScan` (8 s loop, big dish yaw ±15°).
- interior: `Press_<button>` for every hero button + `btn_hatch_ext`/`btn_hatch_int` (0.5 s: in 0.1 s, hold 0.1 s,
  out 0.3 s) and the lamp/button emission turning on (keyframe the material's emission strength / colour);
  `CoverOpen` for `btn_launch_cover`; `PanelBoot` (screens and lamps come on over 2 s).
Lamps: each lamp/button that changes colour gets its own material copy so it can be keyed alone.

## Files (all in ~/dev/oy-karvonsaroyi-3d/hb7/lander_v2/)
- `build_lander_v2.py` — the master (do not edit): resets, makes `Lander`, `lander_base`, `lander_body`,
  collections `LX_exterior` and `LI_interior`, imports `exterior.py` and `interior.py` (if present) and calls
  `build(ctx)` on each, saves `lander_v2.blend`. Args after `--`: `--only exterior|interior`, `--out PATH`,
  `--render NAME` (quick Cycles CPU checks of the result into renders/).
- `exterior.py` (worker A), `interior.py` (worker B), `scene_moon.py` (worker D).
  ctx = dict(root, base, body, col_ext, col_int, spec) — see build_lander_v2.py.
- Astronaut clips (worker C) live in `~/dev/oy-karvonsaroyi-3d/game3d/characters/anim/clips_lander/` (NOT `clips/`,
  so they never ship in the game GLB).
- Materials: prefix `LX_` (exterior) and `LI_` (interior) so the two never collide.
- Renders: `renders/*.png`. Cycles CPU only (Metal is blocked here; EEVEE fails). Keep test renders small
  (≤ 960 px, ≤ 32 samples, OpenImageDenoise on).
- Budget: this is for Blender renders, not the phone game: up to ~400k triangles total is fine; bevel the hard edges
  (bevel modifier or geometry), give everything real thickness, no single-sided planes where they can be seen edge-on.
- No logos, flags, mission names or text on the model (team brand rule).
