# Astronaut animation — brief for clip agents (15 Nov 2026, hackathon freeze 11:00 Tashkent)

You make ONE family of clips for the rigged astronaut of a Moon game (NASA Space Apps 2026). Animation only:
do not touch game code, the repo, git, or other agents' files.

## Files
- Source rig (READ-ONLY, never save over it): `~/dev/oy-karvonsaroyi-3d/game3d/characters/_work/astronaut_rig.blend`
  armature `AstronautRig`, mesh `Astronaut`, 1.86 m tall, faces -Y, soles at z = 0, 30 fps.
- Kit (read it first, do NOT edit): `~/dev/oy-karvonsaroyi-3d/game3d/characters/anim/lunar_rig.py`
- Baker (do NOT edit): `~/dev/oy-karvonsaroyi-3d/game3d/characters/anim/bake_all.py`
- Your clip module: `~/dev/oy-karvonsaroyi-3d/game3d/characters/anim/clips/<yours>.py`
  (helpers you need go in `clips/_<yours>_*.py`; a leading underscore means the baker does not load it as a clip
  module, but you can `import` it — `clips/` is on sys.path).
- Old procedural clips for reference (pose language, the Pour/carry arm solve):
  `~/dev/oy-karvonsaroyi-3d/game3d/characters/build_astronaut.py` section 6.
- If you think the kit has a bug or lacks something, work around it in your own helper file and say so in
  your report. Do not edit the kit.

## Pose language (same as build_astronaut.py)
A clip is `fn(t) -> params dict`, t in [0, 1] over the clip. Params are scalars: degrees / metres.
Rotations are deltas about the REST WORLD axes (X = character's left, Y = back, Z = up; forward is -Y).
Keys: hipX hipY hipZ (pelvis offset, m), hipPitch hipYaw hipRoll, lean, twist, chest, nod, headYaw,
per side k in L/R: th<k> (thigh flex, + forward), legOut<k>, kn<k> (knee, + bends), ft<k>, toe<k>,
arm<k> (+ forward), armOut<k>, armTw<k>, elb<k>, foreTw<k>, wristB<k>, wristR<k>, shrug<k>.
`L.idle_params(0.0)` is the neutral standing pose; `L.carry_arms()` is the solved two-hand bag grip;
`L.HANG` relaxed arms.

## Planting boots: the important part
Clips are IN PLACE. The game moves the character along -Y at `speed` m/s. So a boot planted on the ground must
move BACKWARD (+Y) in clip space at exactly `speed`:  `y(t_sec) = y_touchdown + speed * (t_sec - t_touchdown)`.
Set the pelvis/upper body params first, then call for each leg:

    L.place_foot(p, 'L', pivot, pivot_world, pitch=0, yaw=0, toe=None)   # returns IK miss in m
    pivot: 'heel' (bottom of heel; use for heel strike, pitch < 0 = toes up),
           'ball' (toe joint 3.5 cm above the sole; use for heel-off, pitch > 0 = heel up; the toe stays flat),
           'tip'  (toe tip on the ground), 'ankle' (free swing; give the ankle position)
    Rest landmarks: L.SOLE['L'] = {'heel': (0.21, 0.05, 0), 'ball': (0.22, -0.22, 0.035),
                                   'tip': (0.22, -0.33, 0), 'ankle': (0.21, -0.03, 0.11)}; R mirrors x.

The boot is long (38 cm heel to tip): swing clearance must be checked at the toe tip (`L.boot_points(p, k)`).
Thigh 0.340 m, shin 0.344 m, hip joint at rest z = 0.79, standing hips bone head z = 0.84. If the IK miss is
> 3 mm the pelvis is too high for that foot position: lower the pelvis, shorten the step or lift the heel.
Warm start: the IK starts from p's current th/legOut/kn, so seed them with sensible values (or the previous
frame's) to keep the knee bending forward.

## Moon physics you animate to (NASA; docs/specs/2026-11-14-physics-numbers.md in the team repo)
g_moon = 1.62 m/s². The hips can never accelerate DOWN faster than g while a boot is on the ground
(gravity is the only thing pulling down): hips z'' >= -1.62 everywhere; in flight z'' = -1.62 exactly.
Apollo: walking 0.7-1.0 m/s, alternate-foot lope ~1.4 m/s (top ~2.0), knees bent more, small bounces, slow,
floaty arcs. Apollo 16 John Young jump: 0.42 m, 1.45 s in the air.

## How to run
    cd ~/dev/oy-karvonsaroyi-3d/game3d/characters/anim
    B=/Applications/Blender.app/Contents/MacOS/Blender
    $B -b ../_work/astronaut_rig.blend -P bake_all.py -- --out ../_work/agents/<you> --modules <yours>.py --sheet 2>&1 | grep -E 'ANIM|Error|Traceback|line '
Prints `MEASURE` lines (from the skinned mesh): sink (lowest boot point; must be >= -0.008 m), slide (per boot
vertex, world, while it stays on the ground; must be < 0.02 m), hips z range, hips acc min/max (smoothed 2nd
derivative of the hips height), flight time. `--sheet` writes `sheet_<clips>.png` (side view, 10 cm floor
checks, the camera stays still while the character is moved forward by speed * t — a planted boot must stay on
the same floor squares across tiles) and `sheet_<clips>_34.png` (3/4 front view). LOOK at both PNGs with the
Read tool every iteration and judge them like an animator: silhouette, weight, arcs, knee direction, no
interpenetration, the arms clear the body, the backpack does not bounce, a Moon feel (slow, floaty, knees bent).
Cycles CPU only (Metal is blocked in this sandbox; EEVEE fails). A full bake + sheet takes ~10-30 s.

## Clip spec format (in your module)
    CLIPS = [dict(name='Walk', fn=walk, frames=42, loop=True, speed=1.0, sheet=[0, 7, 14, 21, 28, 35],
                  meta={'note': 'one line'})]
frames = number of frames (30 fps); loop clips must match at t=0 and t=1 (the baker writes frame 0 again as
the last frame). speed = the game speed (m/s) the clip is planted for.

## Report back (short, plain text)
Clip names, frames/seconds, speed, the MEASURE lines, the final sheet paths, what you are unsure about, and any
kit problem you worked around. Keep iterating until the pass rules hold and the sheets look right; stop after
~75 minutes of work at the latest and report what you have.
