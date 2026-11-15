import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { View } from '../state/game';
import { camState, gesture, launchState } from './anim';
import { DOOR_AZ, DOOR_R, HDU, HDU_COMPLEX, HDU_HABITAT, HDU_MODULES, LAYOUT, moduleToGame, RADIUS, type HduModule } from './layout';
import { EYE, FOCUS, POINTS, phasePoint, type PointId, type Vec3 } from './points';
import { GLOW } from './parts/materials';
import { TAP_PX, tapOnly } from './parts/tap';
import { groundHeight } from './ground';
import { freeWalk } from '../walk/enabled';
import { axes, listenKeys, running, walkInput, type Axes } from '../walk/input';
import { heading } from '../walk/move';
import { createWalker, walkDebug } from '../walk/walker';
import { HAB_ROOM, ROOM_K } from '../walk/habitatRoom';
import { habitatDoor, interiorDoors } from './Interiors';
import { ROOMS, ROOM_BODY, buildingOf, doorAt, exitAt, getRoom, inHduComplex, offFacing, roomState, type Room, type RoomId } from '../walk/rooms';
import { doorFade, doorPose, doorTimes, type DoorPlan, type DoorPose, type DoorTimes } from '../walk/doorWalk';
import { climbDuration, climbPhase, climbPose, climbState, type ClimbPose, type LadderClimb } from '../walk/ladder';
import { astraLook } from './AstraBase';
import { BODY, clearance, fits, type Solid, type XZ } from '../walk/collide';
import { tuckState } from '../character/armTuck';
import { BESIDE_ROVER, INSIDE, OUTSIDE, ROVER_AREA, ROVER_DISC } from '../walk/world';
import { footGround, wheelGround } from '../walk/rocks';
import { features } from '../config/features';
import { pickAim, type AimTarget } from '../controls/aim';
import { getRide, onRide, onTravel, setAim, setRide, type Ride } from '../controls/bus';
import { STEP, createBody, stepBody, type Body } from '../character/body';
import { telemetry } from '../character/telemetry';
import { Astronaut, nearCam } from './Astronaut';
import { titleAngles, titlePose, useTitle } from './title';
import { applyRover, arrival, arrivalCameraSpot, DOOR, DRIVABLE, DRIVE, hatchAt, HOP, HOP_OUT, rover, roverAt, sideKey, stepDoors } from './arrival';
import { placeOnGround, stepRover } from './roverDrive';
import { GRAVITY } from '../character/physics.js';

/**
 * First-person rig (final version, Dizayn 2.0). Eye 1.7 m; six standing points + inside; one-finger drag looks
 * around (drag right looks right, drag up looks up; yaw free, pitch ±35°); the base map (M) or a new phase floats
 * you to a point in ~1 s; never teleports, never rolls, no shake. (15 Nov: the glowing ground markers are gone.)
 * The point and the angles are scene-local refs/state, never part of the View.
 *
 * Free walk (features.freeWalk, or ?walk in the address; src/walk/): once the camera has arrived at a point, W A S D,
 * the arrows or the touch stick walk on from it, stopped by the base's hitboxes. The points, the markers and the
 * floats all stay; a float always wins over the keys. Same motion-sickness rules: no bob, no roll, turn ≤ 60°/s.
 *
 * Astronaut (features.character, or ?character; src/character/): outside, you see the suited astronaut from behind
 * and walk it (1 m/s, Shift lopes at 2 m/s, Space or the jump button jumps 0.44 m at Moon gravity); a float becomes
 * one long lunar hop to the point. Inside the habitat and in the truth pull-back the camera is first-person as before.
 *
 * Crew rover (`?drive`, local preview): E beside its hatch climbs in, W S drive and brake, A D steer (or the stick),
 * E again stops it and the astronaut hops out (src/scene/roverDrive.ts, src/scene/arrival.ts).
 */
const character = features.character || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('character'));
const HEAD = 1.55; // the camera aims at the helmet
const camSpot = { x: 0, z: 0 };
const hatch = { x: 0, z: 0, nx: 0, nz: 0 };
const CAM_DIST = 4.6;
const CAM_TILT = 0.22; // rad: the follow camera looks a little down on the astronaut
/** ?drive: on foot, climbing in, driving, braking to get out, hopping out; the hatch used (1 left, −1 right). */
const seat = { stage: 'walk' as 'walk' | 'board' | 'drive' | 'stop' | 'open' | 'out', t: 0, side: 1 };
const pedals = { throttle: 0, steer: 0, brake: false };
const STEER_MAX = 0.45; // rad: the front wheel pairs at full lock (the rear pairs turn the other way)
const cockpit = new THREE.Matrix4();
const ckPos = new THREE.Vector3();
/**
 * The habitat door (ASTRA look, src/scene/Interiors.tsx): E beside it outside goes in, E by the airlock inside goes
 * out. The hatch opens first (DOOR_GO s), then the usual float to the inside point or to the airlock point, and it
 * closes once that is over. t < 0: no trip.
 */
const doorTrip = { to: null as PointId | null, t: -1 };
const DOOR_GO = 0.7;
/**
 * Walking in a building with the astronaut (src/walk/rooms.ts): E on its doorstep outside, facing the door, walks
 * through it (src/walk/doorWalk.ts: the door opens, the astronaut steps into the doorway, a dip to black, inside);
 * E by the door inside, looking at it, walks out the same way. t < 0: no trip; `cut`: past the dip.
 */
const roomTrip = {
  room: null as RoomId | null,
  dir: 0,
  t: -1,
  cut: false,
  plan: { dir: 1, from: { x: 0, z: 0, facing: 0 }, step: { x: 0, z: 0, facing: 0 }, way: null } as DoorPlan,
  T: { atStep: 0, go: 0, cut: 0, end: 0 } as DoorTimes,
};
const doorStep: DoorPose = { x: 0, z: 0, facing: 0, vx: 0, vz: 0 };
/** Where the astronaut's hop to a new point starts (its own feet, not the camera). */
const hopFrom = { x: 0, z: 0 };
/** The dip to black at a door (the canvas's brightness), last value written. */
const fade = { v: 0 };
/**
 * A tap on a door (touch) or "inside" on the base map: the astronaut walks there by itself and goes in through the
 * door — never floats through the wall any more. Any walk key or the stick takes over; it gives up when it stops
 * getting closer (something in the way). `pending`: set by the map, picked up after its hop to the airlock.
 */
const autoDoor = { id: null as RoomId | null, pending: null as RoomId | null, t: 0, best: Infinity, bestT: 0 };
const AUTO_GIVE_UP = 2.5; // s without coming 0.2 m closer
/**
 * The habitat's ladder (E at its foot or at its top): step to the rungs, climb them (src/walk/ladder.ts, ~3.9 s),
 * step off, then on the other floor. With the astronaut it moves between the two floor rooms (the Climb clip on the
 * rungs); in first person (the inside point) the eye rises or sinks along the ladder to the other deck (fp.floor).
 * Walk keys, jump and E are ignored meanwhile.
 */
const climb = {
  to: null as RoomId | null,
  t: -1,
  fp: false,
  arrive: { x: 0, z: 0, facing: 0 },
  T: 0,
  path: { from: { x: 0, z: 0, facing: 0 }, y0: 0, foot: { x: 0, z: 0, facing: 0 }, rungs: { x: 0, z: 0 }, to: { x: 0, z: 0, facing: 0 }, y1: 0 } as LadderClimb,
  pose: { x: 0, y: 0, z: 0, facing: 0, vx: 0, vy: 0, vz: 0, stage: 'done' } as ClimbPose,
};
const fp = { floor: 0 };
/** The room whose door the astronaut stands at now (outside), for E. */
const nearDoor = { id: null as RoomId | null };
/** A room's floor, as the ground the body walks on. */
const roomFloor = { y: 0 };
const roomGround = () => roomFloor.y;
/** What the walk keys ask of the body this step (one object, no allocation per frame). */
const stepWish = { x: 0, z: 0, run: false, jump: false };
/** In a room the follow camera rides closer (native metres behind the head) and a little steeper. */
const ROOM_CAM = 1.7;
/**
 * Which hatch the astronaut gets out of when the rover stops (#18): the left (1) when its hop lands clear, else the
 * right (−1) when that one does; 0 when neither does — then nobody gets out (never into a hitbox). Pure.
 */
export function hopSide(leftClear: boolean, rightClear: boolean): 1 | -1 | 0 {
  return leftClear ? 1 : rightClear ? -1 : 0;
}
/** The HDU modules' centres (game x, z), for "is the camera inside one" (no allocation per frame). */
const HDU_CENTRES = HDU_MODULES.map((id) => moduleToGame(id, 0, 0));
/** Inside any HDU module's lining and below its dome (`?hdu`): its light and its inside ambience. */
function inAnyModule(x: number, y: number, z: number): boolean {
  if (y >= HDU.top) return false;
  for (const [cx, cz] of HDU_CENTRES) if (Math.hypot(x - cx, z - cz) < HDU.lining) return true;
  return false;
}
/**
 * `?hdu` (Samandar, 15 Nov ~14:10: "inside the base, only through the eyes"): in the HDU modules (1.95 m round inside)
 * the camera is the astronaut's own eyes — no follow distance, no downward tilt, the astronaut not drawn (D3's
 * HIDE_NEAR hides it at once). Outside and in ASTRA's rooms the follow camera stays as it was.
 */
const ROOM_TILT = 0.25;
/** D3: nearer than this to the head the astronaut is not drawn (the follow view becomes a first-person one). */
export const HIDE_NEAR = 0.75;
/** ASTRA's rooms: the follow camera this near the head (× the room's scale) is inside the helmet or the backpack. */
const INSIDE_HELMET = 0.5;
/** A room of the HDU complex (`hdu`: the plan has one; the lander's room is ASTRA's, also on the HDU plan). */
export const isHduRoom = (room: Room | null, hdu = HDU_HABITAT): boolean => hdu && room !== null && room.id !== 'lander';
/**
 * Every room through the eyes (15 Nov playtest, ASTRA base: "the logic does not work at all" — in ASTRA's rooms, drawn at
 * 0.6 scale, the follow camera kept pressing into the walls and the astronaut into the camera). The same as Samandar's
 * HDU rooms: no follow distance, no tilt, the astronaut not drawn. False → ASTRA's follow camera as before.
 */
export const EYES_IN_ROOMS = true;
/** Is this room seen through the astronaut's eyes? */
export const eyesIn = (room: Room | null, hdu = HDU_HABITAT): boolean => room !== null && (EYES_IN_ROOMS || isHduRoom(room, hdu));
/** Is the astronaut drawn with the follow camera this far (m, 3D) from its head? (D3; pure) */
export const astronautShown = (camToHead: number): boolean => camToHead >= HIDE_NEAR;
/**
 * How far behind the head (along the look −(fx, fz), horizontal parts) the follow camera rides in a room: its
 * full distance (ASTRA's ROOM_CAM × the room's scale; an HDU room: 0, the eyes), pulled in front of the first
 * wall or furniture on the way (on the ladder: only its outer walls). Pure, no allocation.
 */
export function roomCamDist(room: Room, hx: number, hz: number, fx: number, fz: number, climbing: boolean, hdu = HDU_HABITAT): number {
  if (eyesIn(room, hdu)) return 0; // (first person: the eyes)
  const k2 = room.s;
  const far = ROOM_CAM * k2;
  for (let d = 0.3 * k2; d <= far; d += 0.05 * k2) {
    if (roomBlocked(room.area, hx - fx * d, hz - fz * d, 0.12 * k2, !climbing)) return Math.max(0.25 * k2, d - 0.08 * k2);
  }
  return far;
}
/**
 * How far behind the head (along the look −(fx, fy, fz) at `pitch`) the outside follow camera can ride: `far`, or
 * pulled in front of the first hitbox below `tall` m or, `?hdu`, the HDU complex (rooms.ts inHduComplex). `floor`:
 * the old rule, never nearer than 0.8 m (+2.2 m in the rover, `kc`), even inside what blocks; −1: the boom's rule,
 * no floor, and the ground blocks too (`ground`). Pure, no allocation.
 */
export function followDist(
  hx: number, hy: number, hz: number, yaw: number, pitch: number, far: number, solids: readonly Solid[], tall: number,
  hdu: boolean, floor: number,
): number {
  const fx = -Math.sin(yaw) * Math.cos(pitch);
  const fy = Math.sin(pitch);
  const fz = -Math.cos(yaw) * Math.cos(pitch);
  for (let d = 0.6; d <= far; d += 0.2) {
    const px = hx - fx * d;
    const py = hy - fy * d;
    const pz = hz - fz * d;
    // (the rover's camera rides higher, so taller things count; and it never pulls in under the rover's own roof)
    // (the HDU complex, `?hdu`: its modules are 5.8 m tall, its tunnels 2.6 m: the camera must not swing into a
    // dome or a tunnel either, rooms.ts inHduComplex)
    if ((py < tall && blocked(solids, px, pz)) || (hdu && inHduComplex(px, py, pz, 0.3))) return Math.max(floor, d - 0.3);
  }
  return far;
}
/**
 * How far behind the head (at `pitch`) the boom can ride clear of the HDU complex (0.3 m margin) and 0.3 m above the
 * ground: `far`, or 0.3 m in front of the first sample that is not. Pure, no allocation.
 */
export function boomClear(hx: number, hy: number, hz: number, yaw: number, pitch: number, far: number, ground: (x: number, z: number) => number): number {
  const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
  for (let d = 0.6; d <= far; d += 0.2) {
    const px = hx - fx * d, py = hy - fy * d, pz = hz - fz * d;
    if (inHduComplex(px, py, pz, 0.3) || py < ground(px, pz) + 0.3) return d - 0.3;
  }
  return far;
}
/** `?hdu` boom up (#34): extra look-down tried, in order, when the way back is blocked near the follow camera (rad). */
const BOOM_STEPS = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05];
/** The steepest boom look-down (rad, ~72°: still the astronaut, from above, horizon out of view but level). */
const BOOM_LOW = -1.25;
/** The boom keeps at least this far from the head (m); nearer, the helmet fills the screen. */
export const BOOM_MIN = 1.6;
/** The follow camera's choice: distance from the head, extra look-down (rad, ≥ 0) and the point (game). */
export type FollowCam = { dist: number; extra: number; x: number; y: number; z: number };
/**
 * The outside follow camera on foot (#34). ASTRA (`hdu` false): today's rule — behind the head at `pitch`, pulled in
 * front of the first hitbox below 3.2 m, never nearer than 0.8 m. `?hdu`: the same, but when that leaves it nearer
 * than BOOM_MIN (a module, a tunnel or a prop just behind), it booms up: the first steeper look-down (BOOM_STEPS)
 * whose way back is clear of the complex, the hitboxes and the ground for ≥ BOOM_MIN; none → today's rule.
 * Writes `out` (no allocation) and returns it. The point is kept 0.3 m above `ground`, like Rig does.
 */
export function hduFollowCam(
  out: FollowCam, hx: number, hy: number, hz: number, yaw: number, pitch: number, solids: readonly Solid[],
  ground: (x: number, z: number) => number, hdu = HDU_HABITAT, far = CAM_DIST,
): FollowCam {
  let dist = followDist(hx, hy, hz, yaw, pitch, far, solids, 3.2, hdu, 0.8);
  let p = pitch;
  if (hdu && dist < BOOM_MIN) {
    search: for (const e of BOOM_STEPS) {
      const q = Math.max(BOOM_LOW, pitch - e);
      // (the way back clear of the complex and the ground; then the point itself clear of the hitboxes below 3.2 m:
      // a low ramp or apron between the head and a raised camera hides nothing)
      const fx = -Math.sin(yaw) * Math.cos(q), fy = Math.sin(q), fz = -Math.cos(yaw) * Math.cos(q);
      for (let d = boomClear(hx, hy, hz, yaw, q, far, ground); d >= BOOM_MIN; d -= 0.4) {
        if (hy - fy * d < 3.2 && blocked(solids, hx - fx * d, hz - fz * d)) continue;
        dist = d;
        p = q;
        break search;
      }
      if (q === BOOM_LOW) break;
    }
  }
  out.dist = dist;
  out.extra = pitch - p;
  out.x = hx + Math.sin(yaw) * Math.cos(p) * dist;
  out.y = hy - Math.sin(p) * dist;
  out.z = hz + Math.cos(yaw) * Math.cos(p) * dist;
  out.y = Math.max(out.y, ground(out.x, out.z) + 0.3);
  return out;
}
/**
 * The camera would be in a room's wall or furniture, or outside its walls. (On the ladder only its outer walls
 * count: behind the climber lie the open deck well and its guard rail, then the core rooms' doorways.)
 */
function roomBlocked(a: { solids: readonly Solid[]; bounds: Solid }, x: number, z: number, m: number, furniture = true): boolean {
  if (Math.hypot(x - a.bounds.x, z - a.bounds.z) > a.bounds.r - m) return true;
  if (furniture) for (const o of a.solids) if (clearance(o, x, z, m) < 0) return true;
  return false;
}
/**
 * Standing by the airlock in the habitat's room: more than 2 m towards the door from its middle (model frame). (The
 * HDU habitat, `?hdu`, is 1.95 m round inside: by its door is where E goes out with the astronaut, rooms.ts exit.)
 */
function byAirlock(p: XZ): boolean {
  if (HDU_HABITAT) return ROOMS.habitat.exit(p.x, p.z);
  const dx = p.x - LAYOUT.habitat[0];
  const dz = p.z - LAYOUT.habitat[1];
  return (dx * Math.sin(DOOR_AZ) + dz * Math.cos(DOOR_AZ)) / ROOM_K > 2.0;
}
/** The boom's choice this frame (one object, reused). */
const boom: FollowCam = { dist: 0, extra: 0, x: 0, y: 0, z: 0 };
const ckQ = new THREE.Quaternion();
const ckE = new THREE.Euler();
// m from a hatch: E climbs in (was 3.5: it got in from 2 m off the rover's side). Standing against the rover's side
// the hatch is ~1.2 m away; the astronaut must face it, within HATCH_FACE.
const BOARD_REACH = 1.9;
const HATCH_FACE = (80 * Math.PI) / 180;
// the camera behind the rover: aimed 1.6 m above its middle, 9 m back and 3.5 m up (1.6 + 9.2 · sin 0.21)
const CAR_DIST = 9.2;
const CAR_TILT = 0.21;
const CAR_AIM = 1.6;
// the ground under the feet: the terrain and the rocks low enough to step onto; under the rover's wheels: the rocks
// it climbs (src/walk/rocks.ts)
const ground = footGround;
const wheels = wheelGround;
const reduced = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const MAX_PITCH = THREE.MathUtils.degToRad(35);
const MAX_TURN = THREE.MathUtils.degToRad(reduced ? 40 : 60); // rad/s, motion-sickness rule
const FLOAT_S = reduced ? 1.4 : 1.0;
const DRAG_RAD_PER_PX = 0.0045;

const lander: Vec3 = [LAYOUT.lander[0], 3, LAYOUT.lander[1]];

/** What E (or the ✋ button, or a tap) acts on: the power hub and the machines, at their footprint (src/controls/aim.ts). */
const AIM: AimTarget[] = [
  { k: 'hub', x: LAYOUT.hub[0], z: LAYOUT.hub[1], r: RADIUS.hub, near: 1.6 },
  { k: 'ls', x: LAYOUT.habitat[0], z: LAYOUT.habitat[1], r: RADIUS.habitat },
  { k: 'gh', x: LAYOUT.garden[0], z: LAYOUT.garden[1], r: RADIUS.garden },
  { k: 'ws', x: LAYOUT.workshop[0], z: LAYOUT.workshop[1], r: RADIUS.workshop },
  { k: 'sc', x: LAYOUT.scout[0], z: LAYOUT.scout[1], r: RADIUS.scout },
  { k: 'launch', x: LAYOUT.lander[0], z: LAYOUT.lander[1], r: RADIUS.lander },
];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clampAbs = (v: number, m: number) => Math.max(-m, Math.min(m, v));
/** Something solid where the follow camera would be (a loop, not .some(): no closure per frame). */
function blocked(solids: readonly Solid[], x: number, z: number): boolean {
  for (const o of solids) if (clearance(o, x, z, 0.2) < 0) return true;
  return false;
}
/** One step of a hop in Moon gravity, no air: x, z straight on, y on the exact parabola. */
function fly(b: Body, dt: number) {
  const g = GRAVITY.moon;
  b.x += b.vx * dt;
  b.z += b.vz * dt;
  b.y += b.vy * dt - 0.5 * g * dt * dt;
  b.vy -= g * dt;
}

function anglesTo(from: THREE.Vector3, look: Vec3): [number, number] {
  const dx = look[0] - from.x;
  const dy = look[1] - from.y;
  const dz = look[2] - from.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return [yaw, Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch))];
}

/**
 * While something moves, the shadow map is redrawn this often, s. The perf audit (15 Nov) cut it to 5 Hz, but then
 * the astronaut's shadow trailed up to 0.4 m behind the boots at a lope; ~30 Hz keeps it on the feet (≤ 7 cm).
 * One more redraw always follows the last move, so a body that stops never keeps a stale shadow.
 */
const SHADOW_EVERY = 1 / 30;

export function Rig({ view }: { view: View }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const [point, setPoint] = useState<PointId>(() => phasePoint(view.phase) ?? 'hub');
  const pointNow = useRef(point);
  pointNow.current = point;
  // Free walk: `hop` asks for a float even to the point you last stood at (you may have walked away from it).
  const [hop, setHop] = useState(0);
  // (with the astronaut, the walker walks only inside the habitat, in first person: the astronaut walks outside)
  const walker = useMemo(() => (freeWalk ? createWalker() : null), []);
  const body = useMemo(() => createBody(POINTS.hub.pos[0], POINTS.hub.pos[2], ground), []);
  const c = useRef({ acc: 0, quiet: 0, shadowT: 0, shadowStale: false, car: 0, ck: 0, boom: 0, boomDist: 0, takeoff: NaN, peak: 0, ax: { ahead: 0, side: 0, turn: 0 } as Axes, wish: { x: 0, z: 0 } as XZ }).current;
  const s = useRef({
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    t: 1,
    dur: FLOAT_S,
    yaw: 0,
    pitch: 0,
    yawT: 0,
    pitchT: 0,
    started: false,
  }).current;

  // FOV 60–70° (vertical); a little wider on a portrait phone where the horizontal view is narrow.
  useEffect(() => {
    camera.fov = aspect < 1 ? 70 : 62;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, aspect, invalidate]);

  // Phase → default point (run and unknown phases: stay). With the astronaut (third person) it stays where the
  // player walked it: only a phase that needs another camera moves it (inside, the launch ladder, orbit) — a float
  // across the base on every Next looked like a teleport.
  useEffect(() => {
    const p = phasePoint(view.phase);
    const now = pointNow.current;
    const stay = character && now !== 'inside' && now !== 'orbit' && p !== 'inside' && p !== 'ladder' && p !== 'orbit';
    if (p && !stay) {
      setPoint(p);
      if (walker || character) setHop((h) => h + 1);
    }
    // Walking has a job only while planning (carry batteries hub → machines; 15 Nov): the other phases move the
    // astronaut by themselves (morning airlock, night inside, launch, truth).
    walkInput.phaseOk = view.phase === 'plan';
  }, [view.phase, walker]);

  // The base map (M or 🗺) floats to a standing point, exactly like tapping its glowing marker.
  useEffect(
    () =>
      onTravel((p) => {
        // with the astronaut, "inside" means: hop to the airlock, then walk in through the door
        if (p === 'inside' && character && astraLook && walkInput.phaseOk) {
          autoDoor.pending = 'habitat';
          setPoint('airlock');
        } else setPoint(p);
        setHop((h) => h + 1);
      }),
    [],
  );
  // (The building in front means nothing once the rig is gone.)
  useEffect(() => () => setAim(null), []);
  // dev only: the astronaut's state for the browser console and the door checks (never in the build)
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __astro?: unknown }).__astro = { body, roomTrip, autoDoor, nearDoor, roomState, ROOMS };
  }, [body]);

  // ?drive: E (or the rover button) beside a hatch climbs in; while driving, it stops the rover to get out.
  // The habitat door (ASTRA look): E at it goes in, E by the airlock inside goes out.
  useEffect(() => {
    const off = onRide(() => {
      const r = getRide();
      if ((r === 'up' || r === 'down') && climb.t < 0) {
        // the ladder: with the astronaut from its room; in first person from the inside point's floor
        const from = roomState.id ?? (fp.floor ? 'habitat_up' : 'habitat');
        const L = getRoom(from).ladder;
        if (L) {
          climb.to = L.to;
          climb.fp = !roomState.id;
          climb.arrive = L.arrive;
          // the path: from where the body (or the eye) stands to the rungs, along them, off at the arrival spot
          const P = climb.path;
          P.from.x = climb.fp ? s.to.x : body.x;
          P.from.z = climb.fp ? s.to.z : body.z;
          P.from.facing = climb.fp ? s.yaw + Math.PI : body.facing;
          P.y0 = getRoom(from).floorY;
          P.foot = L.foot;
          P.rungs = climb.fp ? L.foot : L.rungs; // (the eye stays at the foot spot, not in the rungs)
          P.to = L.arrive;
          P.y1 = getRoom(L.to).floorY;
          climb.T = climbDuration(P);
          climb.t = 0;
        }
        setRide(null);
      } else if ((r === 'enter' || r === 'leave') && doorTrip.t < 0 && roomTrip.t < 0) {
        const room = r === 'enter' ? nearDoor.id : roomState.id;
        if (room) {
          // with the astronaut: the door opens, it walks through (or out), the door closes behind
          startRoomTrip(room, r === 'enter' ? 1 : -1);
        } else {
          // first person in the habitat (night, morning): out through the airlock, the usual float
          doorTrip.to = 'airlock';
          doorTrip.t = 0;
          habitatDoor.want = 1;
        }
        setRide(null);
      } else if (seat.stage === 'drive') seat.stage = 'stop';
      else if (seat.stage === 'walk' && r === 'board') boardRover();
      invalidate();
    });
    return () => {
      off();
      setRide(null);
    };
  }, [invalidate]);

  // Free walk: the keys. (The scene draws on demand, so every key press asks for a frame.)
  useEffect(() => (walker || character ? listenKeys(invalidate) : undefined), [walker, invalidate]);

  // New point → float there and turn to its default look.
  useEffect(() => {
    const P = POINTS[point];
    s.to.set(...P.pos);
    if (!s.started) {
      s.started = true;
      camera.position.copy(s.to);
      [s.yaw, s.pitch] = anglesTo(s.to, P.look);
      s.yawT = s.yaw;
      s.pitchT = s.pitch;
      s.t = 1;
      // the astronaut starts on the point, looking where the camera looks (yaw 0 looks down −z, facing 0 is +z)
      body.x = s.to.x;
      body.z = s.to.z;
      body.y = ground(body.x, body.z);
      body.facing = s.yaw + Math.PI;
    } else {
      fp.floor = 0; // (the inside point is on the ground floor)
      // a new phase or the map in the middle of a door: the trip is over (the door closes, the view comes back)
      if (roomTrip.t >= 0) {
        if (roomTrip.room) interiorDoors[buildingOf(roomTrip.room)].want = 0;
        roomTrip.t = -1;
        roomTrip.room = null;
      }
      setFade(0);
      // a new phase or the map while in a building: out at its door at once, the float starts from there
      if (roomState.id) {
        setRoom(null, getRoom(roomState.id).out);
        camera.position.set(body.x, body.y + EYE, body.z);
      }
      // a new phase or the map while in the rover: out at once beside its hatch, and the float starts from there
      if (seat.stage !== 'walk') {
        leaveRover();
        camera.position.set(body.x, body.y + EYE, body.z);
      }
      setRide(null); // (the next frame outside works it out again; inside the habitat E is not for the rover)
      s.from.copy(camera.position);
      // the astronaut's hop starts where the astronaut stands (it used to start at the follow camera, 4.6 m behind:
      // the astronaut jumped back to the camera, then hopped)
      hopFrom.x = body.x;
      hopFrom.z = body.z;
      s.t = 0;
      s.dur = Math.min(2.4, Math.max(FLOAT_S, (character ? Math.hypot(s.to.x - body.x, s.to.z - body.z) : s.from.distanceTo(s.to)) / 14));
      [s.yawT, s.pitchT] = anglesTo(s.to, P.look);
      s.yawT = s.yaw + wrap(s.yawT - s.yaw);
    }
    walker?.stop();
    // (the map's "inside": once the hop lands, walk in through the door)
    autoDoor.id = autoDoor.pending;
    autoDoor.pending = null;
    autoDoor.t = 0;
    autoDoor.best = Infinity;
    autoDoor.bestT = 0;
    invalidate();
  }, [point, hop, camera, invalidate, s, walker, body]);

  // view.focus → turn towards the event, without moving.
  useEffect(() => {
    let target: Vec3 | undefined = view.focus ? FOCUS[view.focus] : undefined;
    if (view.focus === 'sun' && view.sunAzDeg !== undefined) {
      const az = THREE.MathUtils.degToRad(view.sunAzDeg);
      target = [s.to.x + Math.sin(az) * 100, s.to.y + 2.6, s.to.z + Math.cos(az) * 100];
    }
    if (!target) return;
    [s.yawT, s.pitchT] = anglesTo(s.to, target);
    s.yawT = s.yaw + wrap(s.yawT - s.yaw);
    invalidate();
  }, [view.focus, view.sunAzDeg, invalidate, s]);

  // One-finger drag looks around; a move under TAP_PX stays a tap.
  useEffect(() => {
    const el = gl.domElement;
    let down = false;
    let dragging = false;
    let x0 = 0;
    let y0 = 0;
    let lx = 0;
    let ly = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button > 0 || !e.isPrimary) return;
      down = true;
      dragging = false;
      gesture.moved = 0;
      x0 = lx = e.clientX;
      y0 = ly = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!down || !e.isPrimary) return;
      gesture.moved = Math.max(gesture.moved, Math.hypot(e.clientX - x0, e.clientY - y0));
      if (!dragging && gesture.moved > TAP_PX) dragging = true;
      if (dragging) {
        // (yaw grows to the left: a drag to the right looks right; a drag up looks up)
        s.yawT -= (e.clientX - lx) * DRAG_RAD_PER_PX;
        s.pitchT = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitchT - (e.clientY - ly) * DRAG_RAD_PER_PX));
        invalidate();
      }
      lx = e.clientX;
      ly = e.clientY;
    };
    const onUp = () => {
      down = false;
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gl, invalidate, s]);

  // C in the rover: chase camera <-> cockpit
  useEffect(() => {
    if (!DRIVABLE) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyC' || e.repeat || (seat.stage !== 'drive' && seat.stage !== 'stop')) return;
      rover.cam = rover.cam === 'chase' ? 'cockpit' : 'chase';
      invalidate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invalidate]);

  const launching = view.phase === 'launch';

  // Third person: outside, on the ground (not inside the habitat, not the truth pull-back from orbit).
  const third = character && point !== 'inside' && point !== 'orbit';

  // Title camera (src/scene/title.ts): while the reception desk is on screen, a slow film-like arc over the base.
  const title = useTitle();
  const tc = useRef({ t: 0, at: { x: 0, y: 0, z: 0 } }).current;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    nearCam.hide = false; // (the follow camera sets it again, below)
    if (title) {
      tc.t += dt;
      titlePose(tc.t, reduced, tc.at);
      camera.position.set(tc.at.x, tc.at.y, tc.at.z);
      const { yaw, pitch } = titleAngles(tc.at, aspect);
      camera.rotation.set(pitch, yaw, 0, 'YXZ'); // no roll: horizon always level
      camState.inside = false;
      if (features.controls) setAim(null);
      if (!reduced || tc.t < 0.5) invalidate();
      return;
    }
    if (doorTrip.t >= 0) {
      doorTrip.t += dt;
      if (doorTrip.to && doorTrip.t >= DOOR_GO) {
        setPoint(doorTrip.to);
        setHop((h) => h + 1);
        doorTrip.to = null;
      }
      if (doorTrip.t >= DOOR_GO + 2.6) {
        habitatDoor.want = 0; // in (or out): the hatch closes behind
        doorTrip.t = -1;
      }
      invalidate();
    }
    if (climb.t >= 0 && climb.to && s.t < 1) {
      // a new phase or the map floats you away (out of the building) mid-climb: the climb is over
      climb.t = -1;
      climb.to = null;
      climbState.on = false;
    }
    if (climb.t >= 0 && climb.to) {
      climb.t = Math.min(climb.t + dt, climb.T);
      const P = climbPose(climb.path, climb.t, climb.pose);
      const up = climb.path.y1 > climb.path.y0;
      walkInput.jump = false; // (no jump queued up for the other floor)
      climbState.on = !climb.fp && P.stage === 'climb';
      climbState.vy = P.vy;
      // the Climb clip scrubbed by the height above the lower deck (full size): boots and hands meet the rungs
      climbState.phase = climbPhase((P.y - Math.min(climb.path.y0, climb.path.y1)) / getRoom(climb.to).s);
      // look where you go: at the rungs (a little up or down while on them), then the way you step off
      s.yawT = s.yaw + wrap(P.facing + Math.PI - s.yaw);
      if (climb.fp) {
        s.to.set(P.x, P.y + 1.6 * ROOM_K, P.z); // the eye rises (or sinks) along the ladder
        s.pitchT = P.stage === 'climb' ? (up ? 0.3 : -0.3) : 0;
      } else {
        body.x = P.x;
        body.y = P.y;
        body.z = P.z;
        body.facing = P.facing;
        body.vx = P.vx;
        body.vz = P.vz;
        body.vy = 0;
        body.onGround = true;
        body.windup = -1;
      }
      if (climb.t >= climb.T) {
        const R = getRoom(climb.to);
        if (climb.fp) {
          fp.floor = climb.to === 'habitat_up' ? 1 : 0;
          s.to.set(climb.arrive.x, R.floorY + 1.6 * ROOM_K, climb.arrive.z);
          s.pitchT = 0;
        } else {
          // the handover as before; the camera keeps its angle and swings round behind (no jump)
          const yaw = s.yaw, pitch = s.pitch;
          setRoom(climb.to, climb.arrive);
          s.yaw = yaw;
          s.pitch = s.pitchT = pitch;
          s.yawT = s.yaw + wrap(climb.arrive.facing + Math.PI - s.yaw);
        }
        climbState.on = false;
        climbState.vy = 0;
        climb.t = -1;
        climb.to = null;
      }
      invalidate();
    }
    if (third) {
      followAstronaut(dt);
      return;
    }
    // Day 7 launch: keep the rising lander in view (pitch stays clamped, so it leaves the frame upwards).
    if (launching) {
      lander[1] = 3 + launchState.h;
      [s.yawT, s.pitchT] = anglesTo(s.to, lander);
      s.yawT = s.yaw + wrap(s.yawT - s.yaw);
    }

    let walking = false;
    if (s.t < 1) {
      s.t = Math.min(1, s.t + dt / s.dur);
      camera.position.lerpVectors(s.from, s.to, ease(s.t));
    } else {
      // (Never during the launch or the truth sequence: there the camera is not standing on the ground.)
      if (walker && walkInput.phaseOk && climb.t < 0 && (!character || point === 'inside')) {
        // Walk on from the point: the standing spot itself moves, and solid things stop it (src/walk/). Inside the
        // ASTRA habitat: its furnished ground floor, at the room's scale (src/walk/habitatRoom.ts).
        const inside = point === 'inside';
        const room = inside && astraLook;
        walking = walker.step(s.to, s.yaw, room ? (fp.floor ? ROOMS.habitat_up.area : HAB_ROOM) : inside ? INSIDE : OUTSIDE, dt, room ? ROOM_K : 1, room ? ROOM_BODY * ROOM_K : undefined);
        if (!inside) s.to.y = groundHeight(s.to.x, s.to.z) + EYE;
        s.yawT -= walker.turn() * MAX_TURN * dt; // → turns right (yaw grows to the left)
        walkDebug.inside = inside;
      }
      camera.position.copy(s.to);
    }

    const dy = s.yawT - s.yaw;
    const dp = s.pitchT - s.pitch;
    const k = 1 - Math.exp(-6 * dt);
    s.yaw += clampAbs(dy * k, MAX_TURN * dt);
    s.pitch += clampAbs(dp * k, MAX_TURN * dt);
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ'); // no roll: horizon always level

    const [hx, hz] = LAYOUT.habitat;
    // (the HDU habitat, `?hdu`: inside its lining, on either floor)
    camState.inside = HDU_HABITAT
      ? inAnyModule(camera.position.x, camera.position.y, camera.position.z)
      : Math.hypot(camera.position.x - hx, camera.position.z - hz) < 1.6 && camera.position.y < 3;
    // E / ✋: which building is in front (stored only when it changes; nothing while floating or lifting off).
    if (features.controls) setAim(s.t < 1 || launching ? null : pickAim(camera.position.x, camera.position.z, s.yaw, AIM));
    // in the habitat's room, by the airlock (model z > 2 m): E goes out
    {
      let r: Ride | null = null;
      if (point === 'inside' && astraLook && s.t >= 1 && doorTrip.t < 0 && climb.t < 0 && walkInput.phaseOk) {
        const floor = ROOMS[fp.floor ? 'habitat_up' : 'habitat'];
        if (!fp.floor && byAirlock(s.to)) r = 'leave';
        else if (floor.ladder?.near(s.to.x, s.to.z)) r = fp.floor ? 'down' : 'up';
      }
      setRide(r);
    }
    if (s.t < 1 || Math.abs(dy) > 1e-3 || Math.abs(dp) > 1e-3 || launching || walking) invalidate();
  });

  /** In a room (or out of it, null) at a spot: the body at the room's scale, the camera straight behind it. */
  function setRoom(id: RoomId | null, at: { x: number; z: number; facing: number }) {
    roomState.id = id;
    const R = id ? getRoom(id) : null;
    body.scale = R ? R.s : 1;
    roomFloor.y = R ? R.floorY : 0;
    body.x = at.x;
    body.z = at.z;
    body.y = R ? R.floorY : ground(at.x, at.z);
    body.vx = body.vy = body.vz = 0;
    body.onGround = true;
    body.windup = -1;
    body.facing = at.facing;
    s.yaw = s.yawT = at.facing + Math.PI;
    s.pitch = s.pitchT = 0;
  }

  /** The view dips to black while the astronaut passes a door (0 clear … 1 black); written only when it changes. */
  function setFade(v: number) {
    const q = Math.round(v * 20) / 20;
    if (q === fade.v) return;
    fade.v = q;
    gl.domElement.style.filter = q > 0 ? `brightness(${(1 - q).toFixed(2)})` : '';
  }

  /** Turn the body towards a facing at the walk's turning rate (no snap). */
  function turnBody(want: number, dt: number) {
    body.facing += wrap(want - body.facing) * Math.min(1, 10 * dt);
  }

  /** E at a door (or the walk there arriving): the door opens and the astronaut walks through it. */
  function startRoomTrip(room: RoomId, dir: 1 | -1) {
    const R = getRoom(room);
    const P = roomTrip.plan;
    P.dir = dir;
    P.from.x = body.x;
    P.from.z = body.z;
    P.from.facing = body.facing;
    P.step = R.doorstep;
    P.way = R.doorway;
    roomTrip.T = doorTimes(P);
    roomTrip.room = room;
    roomTrip.dir = dir;
    roomTrip.t = 0;
    roomTrip.cut = false;
    autoDoor.id = null;
    body.vx = body.vz = 0;
    interiorDoors[buildingOf(room)].want = 1;
  }

  /** One frame of a door trip (src/walk/doorWalk.ts): outside the body follows the door walk; the cut changes rooms. */
  function stepRoomTrip(dt: number) {
    const P = roomTrip.plan, T = roomTrip.T, room = roomTrip.room!;
    roomTrip.t += dt;
    const t = roomTrip.t;
    const outside = P.dir > 0 ? t < T.cut : roomTrip.cut || t >= T.cut;
    if (P.dir > 0 && t >= T.cut && !roomTrip.cut) {
      roomTrip.cut = true;
      setRoom(room, getRoom(room).spawn);
    } else if (P.dir < 0 && t >= T.cut && !roomTrip.cut) {
      roomTrip.cut = true;
      doorPose(P, t, doorStep, T);
      setRoom(null, doorStep);
    }
    if (outside && !(P.dir > 0 && roomTrip.cut)) {
      doorPose(P, t, doorStep, T);
      body.x = doorStep.x;
      body.z = doorStep.z;
      body.y = ground(body.x, body.z);
      body.vx = doorStep.vx;
      body.vz = doorStep.vz;
      body.vy = 0;
      body.onGround = true;
      body.windup = -1;
      turnBody(doorStep.facing, dt);
      // the camera swings round behind the astronaut as it turns to the door (or out of it)
      s.yawT = s.yaw + wrap(body.facing + Math.PI - s.yaw);
    } else if (!roomTrip.cut) {
      // inside, while the door opens: turn to it and wait
      const R = getRoom(room);
      turnBody(Math.atan2(R.inDoor.x - body.x, R.inDoor.z - body.z), dt);
      body.vx = body.vz = 0;
    }
    setFade(doorFade(P, t, T));
    c.acc = 0;
    walkInput.jump = false;
    s.to.set(body.x, body.y + EYE, body.z);
    if (t >= T.end) {
      interiorDoors[buildingOf(room)].want = 0; // through: the door closes behind
      roomTrip.t = -1;
      roomTrip.room = null;
      setFade(0);
    }
  }

  /** The walk to a door by itself (a tap on the door, the map's "inside"): steer to its doorstep, then go in. */
  function steerToDoor(dt: number) {
    const id = autoDoor.id!;
    if (body.onGround && body.windup < 0 && doorAt(body, body.facing) === id) {
      startRoomTrip(id, 1);
      return;
    }
    const st = getRoom(id).doorstep;
    const dx = st.x - body.x, dz = st.z - body.z;
    const d = Math.hypot(dx, dz);
    autoDoor.t += dt;
    if (d < autoDoor.best - 0.2) {
      autoDoor.best = d;
      autoDoor.bestT = autoDoor.t;
    }
    if (autoDoor.t - autoDoor.bestT > AUTO_GIVE_UP || autoDoor.t > 30) {
      autoDoor.id = null; // something in the way: the child walks from here
      return;
    }
    if (d > 0.15) {
      const k = Math.min(1, 0.3 + d / 0.6); // slows down onto the doorstep
      c.wish.x = (dx / d) * k;
      c.wish.z = (dz / d) * k;
    } else {
      // on the doorstep: lean towards the door, so the astronaut turns to face it
      c.wish.x = Math.sin(st.facing) * 0.5;
      c.wish.z = Math.cos(st.facing) * 0.5;
    }
  }

  /** The astronaut's frame: hop to a new point, or walk; then the follow camera behind it. */
  /**
   * `?arrive` (local preview): ride in the crew rover while it drives to its spot (hidden at its hatch sill, the
   * camera beside the rover), crouch, hop out onto the ground in a Moon fall, then hand over (src/scene/arrival.ts).
   */
  function scriptArrival(dt: number) {
    arrival.t += dt;
    roverAt(arrival.t, rover);
    placeOnGround(rover, wheels);
    const h = hatchAt(rover, hatch);
    const T0 = DRIVE.T + DRIVE.pause;
    if (arrival.t < T0 + DOOR.T) {
      // riding: on the hatch sill, inside, facing out; parked, the hatch door swings open first
      sit(h);
      if (arrival.t >= T0) rover.doorWant.L = 1;
    } else {
      rover.crew = false;
      if (hopFromHatch(arrival.t - T0 - DOOR.T, h, dt)) {
        rover.doorWant.L = 0; // landed: the door closes behind
        rover.driver = null; // the player has control again
        s.t = 1;
        s.pitch = s.pitchT = 0;
        s.yawT = s.yaw + wrap(body.facing + Math.PI - s.yaw); // swing round behind the astronaut, the short way
      }
    }
    s.to.set(body.x, body.y + EYE, body.z);
  }

  /** In the rover: on its hatch sill, facing out, still (not drawn while `rover.crew`). */
  function sit(h: typeof hatch) {
    body.x = h.x;
    body.z = h.z;
    body.y = wheels(h.x, h.z) + HOP.sill;
    body.vx = body.vy = body.vz = 0;
    body.onGround = true;
    body.windup = -1;
    body.facing = Math.atan2(h.nx, h.nz);
  }

  /** Crouch on the hatch sill, hop out and fall to the ground (t: seconds since the crouch began). True on landing. */
  function hopFromHatch(t: number, h: typeof hatch, dt: number): boolean {
    if (t < HOP.crouch) {
      sit(h);
      body.windup = t; // the JumpStart clip, scrubbed by the crouch
      return false;
    }
    if (body.onGround) {
      body.windup = -1;
      body.onGround = false;
      body.v0 = body.vy = HOP.up;
      body.vx = h.nx * HOP.out;
      body.vz = h.nz * HOP.out;
      return false;
    }
    fly(body, dt);
    const gy = ground(body.x, body.z);
    if (body.y > gy || body.vy > 0) return false;
    body.y = gy;
    body.vx = body.vz = body.vy = 0;
    body.onGround = true;
    return true;
  }

  /** The side (1 left, −1 right) of the rover's hatch within reach of the astronaut, the nearer one; 0: none. */
  /** The hatch the astronaut stands at and faces (1 left, −1 right), or 0: none within reach. */
  function nearHatch(): number {
    const left = hatchGap(1);
    const right = hatchGap(-1);
    return Math.min(left, right) > BOARD_REACH ? 0 : left <= right ? 1 : -1;
  }
  /** How far the astronaut is from this side's hatch, or Infinity when it is not facing it. */
  function hatchGap(side: number): number {
    hatchAt(rover, hatch, side);
    if (offFacing(body, body.facing, hatch.x, hatch.z) > HATCH_FACE) return Infinity;
    return Math.hypot(body.x - hatch.x, body.z - hatch.z);
  }

  /** Whether the hop out of this side's hatch lands on free ground (not in a building beside the rover). */
  // (not counting the rover's own hitbox: the hop always lands inside it, so with it neither side was ever clear and
  // the astronaut always got out on the left, into whatever stood there)
  function landsClear(side: number): boolean {
    const h = hatchAt(rover, hatch, side);
    return fits(h.x + h.nx * HOP_OUT, h.z + h.nz * HOP_OUT, BESIDE_ROVER);
  }

  function boardRover() {
    seat.side = nearHatch();
    if (!seat.side) return;
    seat.stage = 'board';
    seat.t = 0;
    body.vx = body.vz = 0;
  }

  /** Out of the rover at once (a new phase, the map): stopped where it is, the astronaut on the ground by its hatch. */
  function leaveRover() {
    rover.speed = 0;
    rover.driver = null;
    rover.crew = false;
    rover.doorWant.L = rover.doorWant.R = 0;
    rover.steer = rover.steerInput = 0;
    rover.cam = 'chase';
    ROVER_DISC.x = rover.x;
    ROVER_DISC.z = rover.z;
    const h = hatchAt(rover, hatch, seat.side);
    body.x = h.x + h.nx * HOP_OUT;
    body.z = h.z + h.nz * HOP_OUT;
    body.y = ground(body.x, body.z);
    body.vx = body.vy = body.vz = 0;
    body.onGround = true;
    body.windup = -1;
    seat.stage = 'walk';
    setRide(null);
  }

  /**
   * ?drive: climb into the crew rover (crouch, then the hop out played backwards, up onto the hatch sill), drive it
   * with the walk keys or the stick (src/scene/roverDrive.ts), and on E brake to a stop and hop out like the arrival.
   * Returns true while something moves.
   */
  function rideRover(dt: number): boolean {
    seat.t += dt;
    walkInput.jump = false; // (no jumping from the driver's seat)
    let moving = true;
    const h = hatchAt(rover, hatch, seat.side);
    if (seat.stage === 'board') {
      rover.doorWant[sideKey(seat.side)] = 1; // opens while the astronaut crouches (both take ~0.8 s)
      const sill = wheels(h.x, h.z) + HOP.sill;
      if (seat.t < HOP.crouch) {
        body.windup = seat.t; // the JumpStart clip, scrubbed by the crouch, facing the hatch
        body.facing = Math.atan2(h.x - body.x, h.z - body.z);
      } else if (body.onGround) {
        // take off on the arc that lands on the sill: the hop out backwards (it arrives falling at HOP.up)
        const g = GRAVITY.moon;
        body.v0 = body.vy = Math.sqrt(Math.max(0, HOP.up * HOP.up + 2 * g * (sill - body.y)));
        const T = (body.vy + HOP.up) / g;
        body.vx = (h.x - body.x) / T;
        body.vz = (h.z - body.z) / T;
        body.windup = -1;
        body.onGround = false;
      } else {
        fly(body, dt);
        if (body.vy < 0 && body.y <= sill) {
          sit(h);
          rover.crew = true;
          rover.driver = 'player';
          rover.doorWant[sideKey(seat.side)] = 0; // in: the door closes behind
          seat.stage = 'drive';
          s.pitchT = 0; // a level look down the road
        }
      }
    } else if (seat.stage === 'drive' || seat.stage === 'stop') {
      const braking = seat.stage === 'stop';
      axes(c.ax);
      pedals.throttle = braking ? 0 : c.ax.ahead;
      pedals.steer = braking ? 0 : clampAbs(c.ax.side + c.ax.turn, 1);
      pedals.brake = braking;
      moving = stepRover(rover, pedals, ROVER_AREA, wheels, dt) || braking;
      // the wheels follow the stick a little behind it (a steering motor, not a snap)
      rover.steerInput += (pedals.steer - rover.steerInput) * (1 - Math.exp(-6 * dt));
      rover.steer = -rover.steerInput * STEER_MAX;
      moving = moving || Math.abs(pedals.steer - rover.steerInput) > 1e-3;
      sit(hatchAt(rover, hatch, seat.side));
      if (braking && rover.speed === 0) {
        // stopped: its hitbox moves here, and the astronaut gets out on a side with room to land
        ROVER_DISC.x = rover.x;
        ROVER_DISC.z = rover.z;
        const side = hopSide(landsClear(1), landsClear(-1));
        if (side === 0) {
          // (#18) neither side lands clear (a building, a rock, the complex beside it): stay at the wheel, drive on
          seat.stage = 'drive';
        } else {
          seat.side = side;
          seat.stage = 'open';
          seat.t = 0;
          rover.steer = rover.steerInput = 0;
          rover.cam = 'chase';
          rover.doorWant[sideKey(seat.side)] = 1;
        }
      }
    } else if (seat.stage === 'open') {
      // the hatch door swings open, then the astronaut steps onto the sill and hops out
      sit(h);
      if (seat.t >= DOOR.T) {
        seat.stage = 'out';
        seat.t = 0;
        rover.crew = false;
      }
    } else if (hopFromHatch(seat.t, h, dt)) {
      // out: landed, on foot again; the door closes behind
      rover.doorWant[sideKey(seat.side)] = 0;
      seat.stage = 'walk';
      rover.driver = null;
      s.yawT = s.yaw + wrap(body.facing + Math.PI - s.yaw); // swing round behind the astronaut, the short way
    }
    s.to.set(body.x, body.y + EYE, body.z);
    return moving;
  }

  /** Camera for the arrival: on the ground beside the parking spot, eased onto the rover, then onto the astronaut. */
  function arrivalCamera(dt: number) {
    const spot = arrivalCameraSpot(camSpot);
    const cy = ground(spot.x, spot.z) + 1.9;
    const tx = rover.crew ? rover.x : body.x;
    const tz = rover.crew ? rover.z : body.z;
    const ty = rover.crew ? ground(rover.x, rover.z) + 1.3 : body.y + 1.0;
    const L = arrival.look;
    if (!Number.isFinite(L.x)) {
      L.x = tx;
      L.y = ty;
      L.z = tz;
    }
    const k = 1 - Math.exp(-4 * dt);
    L.x += (tx - L.x) * k;
    L.y += (ty - L.y) * k;
    L.z += (tz - L.z) * k;
    const dx = L.x - spot.x, dy = L.y - cy, dz = L.z - spot.z;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(dy, Math.hypot(dx, dz))));
    camera.position.set(spot.x, cy, spot.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ'); // no roll
    s.yaw = s.yawT = yaw;
    camState.inside = false;
  }

  function followAstronaut(dt: number) {
    let active = stepDoors(dt);
    // ?arrive: starts once the game screen is up (not under the title), then runs to the end
    const scripted = rover.driver === 'arrival' && (arrival.t > 0 || walkInput.inGame);
    if (scripted) {
      scriptArrival(dt);
      if (rover.driver === 'arrival') {
        arrivalCamera(dt);
        if (features.controls) setAim(null);
        c.shadowT -= dt;
        if (c.shadowT <= 0) {
          c.shadowT = SHADOW_EVERY;
          gl.shadowMap.needsUpdate = true; // the rover's shadow moves with it
        }
        invalidate();
        return;
      }
      active = true;
    } else if (rover.driver === 'arrival') {
      // title screen: the astronaut waits in the rover; nothing to step
    } else if (seat.stage !== 'walk') {
      active = rideRover(dt);
    } else if (roomTrip.t >= 0 && roomTrip.room && s.t >= 1) {
      // through a door: the walk is scripted (src/walk/doorWalk.ts); the keys wait
      stepRoomTrip(dt);
      active = true;
    } else if (s.t < 1) {
      // a float is one long lunar hop: glide along the line, a parabola over it, the JumpAir pose scrubbed by it
      s.t = Math.min(1, s.t + dt / s.dur);
      const t = ease(s.t);
      const dx = s.to.x - hopFrom.x;
      const dz = s.to.z - hopFrom.z;
      const d = Math.hypot(dx, dz);
      body.x = hopFrom.x + dx * t;
      body.z = hopFrom.z + dz * t;
      body.y = ground(body.x, body.z) + Math.sin(Math.PI * s.t) * Math.min(2.5, d * 0.12);
      body.vx = 0;
      body.vz = 0;
      body.v0 = 1.2;
      body.vy = 1.2 * (1 - 2 * s.t);
      body.onGround = s.t >= 1 || d < 0.5;
      body.windup = -1;
      if (d > 0.5) body.facing = Math.atan2(dx, dz);
      if (s.t >= 1) {
        // landed: stand on the point and turn to what the camera turns to
        body.y = ground(body.x, body.z);
        body.vy = 0;
        body.facing = s.yawT + Math.PI;
      }
      active = true;
    } else if (climb.t >= 0) {
      // on the habitat's ladder: the climb above moved the body (src/walk/ladder.ts); the walk keys wait
      c.acc = 0;
      s.to.set(body.x, body.y + EYE, body.z);
      active = true;
    } else if (walkInput.phaseOk) {
      axes(c.ax);
      heading(s.yaw, c.ax.ahead, c.ax.side, c.wish);
      s.yawT -= c.ax.turn * MAX_TURN * dt; // → turns right (yaw grows to the left)
      // walking to a door by itself (a tap on it, the map): the keys or the stick take over at once
      if (autoDoor.id && (c.ax.ahead !== 0 || c.ax.side !== 0 || roomState.id)) autoDoor.id = null;
      if (autoDoor.id) steerToDoor(dt);
      c.acc = Math.min(c.acc + dt, 0.1);
      // in a building: its room, its floor, the body at its scale (src/walk/rooms.ts)
      const R = roomState.id ? getRoom(roomState.id) : null;
      while (c.acc >= STEP) {
        c.acc -= STEP;
        const air = !body.onGround;
        stepWish.x = c.wish.x;
        stepWish.z = c.wish.z;
        stepWish.run = running();
        stepWish.jump = walkInput.jump && (!R || R.jump);
        active = (R ? stepBody(body, stepWish, R.area, roomGround, GRAVITY.moon, R.s, ROOM_BODY * R.s) : stepBody(body, stepWish, OUTSIDE, ground)) || active;
        walkInput.jump = false;
        if (R) continue; // (the jump hologram measures full-size jumps outside)
        // measure the jump for the visor hologram: from take-off to the top, reported on landing
        if (!air && !body.onGround) {
          c.takeoff = body.y;
          c.peak = body.y;
        }
        if (!body.onGround) c.peak = Math.max(c.peak, body.y);
        if (air && body.onGround && Number.isFinite(c.takeoff)) {
          telemetry.landed(c.peak - c.takeoff);
          c.takeoff = NaN;
        }
      }
      s.to.set(body.x, body.y + EYE, body.z);
    }

    // in the rover the camera rides behind it (glides there and back in 1.2 s) and swings round behind it as it
    // drives; standing still you can look all round
    const inCar = seat.stage === 'drive' || seat.stage === 'stop';
    c.car = Math.max(0, Math.min(1, c.car + (inCar ? dt : -dt) / 1.2));
    const kc = ease(c.car);
    if (inCar) s.yawT += wrap(rover.yaw + Math.PI - s.yawT) * (1 - Math.exp(-2 * dt * Math.min(1, Math.abs(rover.speed))));

    const dy = s.yawT - s.yaw;
    const dp = s.pitchT - s.pitch;
    const k = 1 - Math.exp(-6 * dt);
    s.yaw += clampAbs(dy * k, MAX_TURN * dt);
    s.pitch += clampAbs(dp * k, MAX_TURN * dt);

    // follow camera: behind and a little above the helmet (or the rover), pulled in front of anything solid, never
    // under the ground
    // (on the ladder: the room the head is in, between the two floors' floor and ceiling)
    const climbing = climb.t >= 0 && climb.to !== null && roomState.id !== null;
    const room = climbing
      ? getRoom((body.y - climb.path.y0) / (climb.path.y1 - climb.path.y0 || 1) > 0.5 ? climb.to! : roomState.id!)
      : roomState.id
        ? getRoom(roomState.id)
        : null;
    // (an HDU room is seen through the eyes: level, no follow tilt)
    const tilt = room ? (eyesIn(room) ? 0 : ROOM_TILT) : CAM_TILT + (CAR_TILT - CAM_TILT) * kc;
    let pitch = Math.max(-MAX_PITCH - tilt, s.pitch - tilt);
    const hx = body.x + (rover.x - body.x) * kc;
    const hy = body.y + HEAD * body.scale + (rover.y + CAR_AIM - body.y - HEAD) * kc;
    const hz = body.z + (rover.z - body.z) * kc;
    // `?hdu` on foot outside (#34): blocked just behind by the complex or a prop, the camera booms up — looks down
    // more from higher instead of pinning 0.8 m behind the helmet (hduFollowCam); the extra look-down eases in and
    // out over ~0.3 s, the distance grows back as smoothly (pulling in stays at once: never into a dome)
    const boomed = HDU_HABITAT && !room && kc === 0 && !scripted;
    if (boomed) {
      hduFollowCam(boom, hx, hy, hz, s.yaw, pitch, OUTSIDE.solids, ground, true);
      c.boom += (boom.extra - c.boom) * (1 - Math.exp(-10 * dt));
      pitch = Math.max(BOOM_LOW, pitch - c.boom);
    } else c.boom = 0;
    const fx = -Math.sin(s.yaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = -Math.cos(s.yaw) * Math.cos(pitch);
    let dist: number;
    if (room) {
      // in a room: closer, kept inside its walls and clear of its furniture, under its ceiling
      dist = roomCamDist(room, hx, hz, fx, fz, climbing);
    } else {
      const far = CAM_DIST + (CAR_DIST - CAM_DIST) * kc;
      const solids = inCar ? ROVER_AREA.solids : OUTSIDE.solids;
      dist = scripted ? far : followDist(hx, hy, hz, s.yaw, pitch, far, solids, inCar ? 5 : 3.2, HDU_HABITAT, 0.8 + 2.2 * kc);
      if (boomed && (boom.extra > 0 || c.boom > 0.01)) {
        // (the boom's distance, never past the complex or into the ground at the eased look-down; it grows back
        // smoothly and pulls in at once)
        const want = Math.min(boom.extra > 0 ? boom.dist : dist, boomClear(hx, hy, hz, s.yaw, pitch, far, ground));
        c.boomDist = want < c.boomDist ? want : c.boomDist + (want - c.boomDist) * (1 - Math.exp(-10 * dt));
        dist = c.boomDist;
      } else c.boomDist = dist;
    }
    camera.position.set(hx - fx * dist, hy - fy * dist, hz - fz * dist);
    if (climbing) {
      const a = getRoom(roomState.id!), b = getRoom(climb.to!);
      camera.position.y = Math.min(Math.max(camera.position.y, Math.min(a.floorY, b.floorY) + 0.3 * a.s), Math.max(a.ceilY, b.ceilY) - 0.1 * a.s);
    } else if (room) camera.position.y = Math.min(Math.max(camera.position.y, room.floorY + 0.3 * room.s), room.ceilY - 0.1 * room.s);
    else camera.position.y = Math.max(camera.position.y, ground(camera.position.x, camera.position.z) + 0.3);
    camera.rotation.set(pitch, s.yaw, 0, 'YXZ'); // no roll: horizon always level
    // (any room of the HDU complex is inside: its light, its ambience)
    camState.inside = isHduRoom(room);
    // the rover model and its steered wheels, in the same frame as the camera (no lag between them)
    if (seat.stage !== 'walk' || scripted) applyRover();
    // C in the rover: the cockpit view, from behind the driver's helmet down the road (heading only: level horizon).
    // It glides in and out in 0.6 s, also when the rover stops to let the astronaut out (no jump of the camera).
    c.ck = Math.max(0, Math.min(1, c.ck + (inCar && rover.cam === 'cockpit' ? dt : -dt) / 0.6));
    if (c.ck > 0 && rover.object && rover.camLocal) {
      rover.object.updateMatrixWorld(true);
      cockpit.multiplyMatrices(rover.object.matrixWorld, rover.camLocal);
      ckPos.setFromMatrixPosition(cockpit);
      ckQ.setFromEuler(ckE.set(-0.2, rover.yaw + Math.PI, 0, 'YXZ')); // 15° down, like the model's sev_cam_cockpit
      const kk = ease(c.ck);
      camera.position.lerp(ckPos, kk);
      camera.quaternion.slerp(ckQ, kk);
    }
    // D3: too near the head (a tight room, a wall behind): the astronaut is not drawn, the view is first person
    // (`?hdu`, on foot). ASTRA keeps its picture, except when a wall behind has pushed the camera into the helmet or
    // the backpack itself (closer than INSIDE_HELMET × the room's scale): then too, rather than a screen of helmet.
    {
      const camToHead = Math.hypot(camera.position.x - hx, camera.position.y - hy, camera.position.z - hz);
      nearCam.hide =
        kc === 0 && (HDU_HABITAT ? !astronautShown(camToHead) : room !== null && camToHead < INSIDE_HELMET * room.s);
    }

    // E / hand button: the building in front of the astronaut (its facing, in the camera's yaw convention)
    if (features.controls) setAim(s.t < 1 || launching || seat.stage !== 'walk' || room || roomTrip.t >= 0 ? null : pickAim(body.x, body.z, body.facing + Math.PI, AIM));
    // E (stored only when it changes): the rover (?drive); a building's door outside (in) or inside (out)
    const onFoot = seat.stage === 'walk' && !scripted && s.t >= 1 && walkInput.phaseOk && body.onGround && body.windup < 0;
    let ride: Ride | null = null;
    if (DRIVABLE && !room) ride = seat.stage === 'drive' ? 'exit' : onFoot && nearHatch() ? 'board' : null;
    // (at the door means on its doorstep and facing it: src/walk/rooms.ts doorAt; inside, looking towards it)
    nearDoor.id = astraLook && onFoot && !room && roomTrip.t < 0 ? doorAt(body, body.facing) : null;
    if (!ride && onFoot && doorTrip.t < 0 && roomTrip.t < 0) {
      if (room && climb.t < 0) {
        if (!room.noDoor && exitAt(room, body, body.facing)) ride = 'leave';
        else if (room.ladder?.near(body.x, body.z)) ride = getRoom(room.ladder.to).floorY > room.floorY ? 'up' : 'down';
      }
      else if (nearDoor.id) ride = 'enter';
    }
    setRide(ride);
    // arms in by a wall (src/character/armTuck.ts): always in a room and through a door; outside, from 25 cm off a
    // building or a rock; never in the rover or on the ladder
    if (room || roomTrip.t >= 0) {
      tuckState.want = 1;
      tuckState.maxSide = ROOM_BODY + 0.03;
    } else if (seat.stage !== 'walk' || climb.t >= 0 || scripted) {
      tuckState.want = 0;
    } else {
      let gap = Infinity;
      for (const o of OUTSIDE.solids) {
        const g = clearance(o, body.x, body.z, BODY);
        if (g < gap) gap = g;
      }
      tuckState.want = Math.max(0, Math.min(1, (0.25 - gap) / 0.2));
      tuckState.maxSide = BODY + 0.03;
    }
    // the Sun's shadow map is drawn once a day; while the astronaut moves, redraw it ~30 times a second, and once
    // more when it has settled (the legs blend back to Idle while `quiet` runs down; else the last redraw, up to
    // SHADOW_EVERY old, stays: a shadow beside the boots)
    const moving = active || c.quiet > 0;
    c.shadowT -= dt;
    if (moving) c.shadowStale = true;
    if (c.shadowStale && (!moving || c.shadowT <= 0)) {
      c.shadowT = SHADOW_EVERY;
      c.shadowStale = moving;
      gl.shadowMap.needsUpdate = true;
    }
    c.quiet = active ? 0.6 : Math.max(0, c.quiet - dt);
    if (active || c.quiet > 0 || (c.car > 0 && c.car < 1) || (c.ck > 0 && c.ck < 1) || Math.abs(dy) > 1e-3 || Math.abs(dp) > 1e-3 || launching) invalidate();
  }

  // The glowing ground markers are gone (15 Nov, "make it a game"): you walk, the base map (M) floats you to a
  // standing point, and each phase still moves you on by itself. Only the habitat door stays tappable.
  const goInside = useMemo(
    () =>
      (() => {
        const tap = tapOnly(() => {
          // with the astronaut: it walks to the door and goes in through it (it used to float in through the wall
          // from anywhere on the base); only while walking is allowed (the plan)
          if (character && astraLook) {
            if (!walkInput.phaseOk || roomState.id || roomTrip.t >= 0 || seat.stage !== 'walk') return;
            autoDoor.id = 'habitat';
            autoDoor.t = 0;
            autoDoor.best = Infinity;
            autoDoor.bestT = 0;
            invalidate();
            return;
          }
          setPoint('inside');
          setHop((h) => h + 1);
        });
        // with the astronaut a mouse click looks around and the astronaut walks in by the door (E): a click that
        // happened to land on the door floated it inside; a finger still taps the door
        return (e: ThreeEvent<MouseEvent>) => (character && (e.nativeEvent as PointerEvent).pointerType === 'mouse' ? undefined : tap(e));
      })(),
    [],
  );
  // (the HDU habitat's door, `?hdu`: 1.0 × 2.0 m from its floor, HDU.floor up)
  const door: Vec3 = [LAYOUT.habitat[0] + Math.sin(DOOR_AZ) * DOOR_R, HDU_HABITAT ? HDU.floor + HDU.door.h / 2 : 1.1, LAYOUT.habitat[1] + Math.cos(DOOR_AZ) * DOOR_R];
  const hideMarkers = launching || view.phase === 'truth' || title;
  // D2 (`?hdu`): every module's door glows and can be tapped (module frame: the door at +z, its outer face
  // HDU.front); a finger on the greenhouse's or the lab's door walks the astronaut in when it stands at that door
  const hduDoors = useMemo(
    () =>
      HDU_HABITAT
        ? HDU_MODULES.map((id: HduModule) => {
            const [x, z] = moduleToGame(id, 0, HDU.front + 0.05);
            const pos: Vec3 = [x, HDU.floor + HDU.door.h / 2, z];
            const tap =
              id === 'habitat'
                ? goInside
                : tapOnly(() => {
                    if (nearDoor.id !== id || doorTrip.t >= 0 || roomTrip.t >= 0) return;
                    roomTrip.room = id;
                    roomTrip.dir = 1;
                    roomTrip.t = 0;
                    interiorDoors[buildingOf(id)].want = 1;
                    invalidate();
                  });
            return { id, pos, tap };
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goInside],
  );

  const astronaut = character ? <Astronaut body={body} visible={point !== 'inside'} hands={view.hands ?? 0} view={view} /> : null;

  return hideMarkers ? (
    astronaut
  ) : (
    <group>
      {astronaut}
      {point !== 'inside' &&
        hduDoors?.map((d) => (
          <group key={d.id} position={d.pos} rotation-y={HDU_COMPLEX.turn}>
            <mesh scale={[0.68, 1.32, 1]} material={GLOW.marker}>
              <ringGeometry args={[0.64, 0.7, 4, 1, Math.PI / 4]} />
            </mesh>
            {/* tap target: the whole door, invisible */}
            <mesh position-z={0.05} onClick={d.tap}>
              <planeGeometry args={[1.0, 1.9]} />
              <meshBasicMaterial visible={false} />
            </mesh>
          </group>
        ))}
      {point !== 'inside' && !hduDoors && (
        <group position={door} rotation-y={DOOR_AZ}>
          <mesh scale={[0.68, 1.32, 1]} material={GLOW.marker}>
            <ringGeometry args={[0.64, 0.7, 4, 1, Math.PI / 4]} />
          </mesh>
          {/* tap target: the whole door, invisible */}
          <mesh position-z={0.05} onClick={goInside}>
            <planeGeometry args={[1.0, 1.9]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}
