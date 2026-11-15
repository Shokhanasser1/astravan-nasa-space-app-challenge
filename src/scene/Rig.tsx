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
import { ROOMS, ROOM_BODY, buildingOf, doorAt, getRoom, inHduComplex, roomState, type Room, type RoomId } from '../walk/rooms';
import { climbDuration, climbPhase, climbPose, climbState, type ClimbPose, type LadderClimb } from '../walk/ladder';
import { astraLook } from './AstraBase';
import { clearance, fits, type Solid, type XZ } from '../walk/collide';
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
import { BOARD_PATH, boardClimbPhase, boardPose, boardState, boarding } from './boarding';

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
 * Walking in a building with the astronaut (src/walk/rooms.ts): E at its door outside opens it and steps in, E by
 * the door inside steps out. dir 1 in, −1 out, 0 done (the door is closing); t < 0: no trip.
 */
const roomTrip = { room: null as RoomId | null, dir: 0, t: -1 };
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
/** A room of the HDU complex (`hdu`: the plan has one; the lander's room is ASTRA's, also on the HDU plan). */
export const isHduRoom = (room: Room | null, hdu = HDU_HABITAT): boolean => hdu && room !== null && room.id !== 'lander';
/** Is the astronaut drawn with the follow camera this far (m, 3D) from its head? (D3; pure) */
export const astronautShown = (camToHead: number): boolean => camToHead >= HIDE_NEAR;
/**
 * How far behind the head (along the look −(fx, fz), horizontal parts) the follow camera rides in a room: its
 * full distance (ASTRA's ROOM_CAM × the room's scale; an HDU room: 0, the eyes), pulled in front of the first
 * wall or furniture on the way (on the ladder: only its outer walls). Pure, no allocation.
 */
export function roomCamDist(room: Room, hx: number, hz: number, fx: number, fz: number, climbing: boolean, hdu = HDU_HABITAT): number {
  if (isHduRoom(room, hdu)) return 0; // (first person: the eyes)
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
const BOARD_REACH = 3.5; // m from a hatch: E climbs in
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
/** Day 7 boarding (home story): what the boarding shot looks at (the astronaut's chest; no allocation per frame). */
const boardLook: Vec3 = [0, 0, 0];

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
        setPoint(p);
        setHop((h) => h + 1);
      }),
    [],
  );
  // (The building in front means nothing once the rig is gone.)
  useEffect(() => () => setAim(null), []);

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
          // with the astronaut: the door opens, it steps in (or out), the door closes behind
          roomTrip.room = room;
          roomTrip.dir = r === 'enter' ? 1 : -1;
          roomTrip.t = 0;
          interiorDoors[buildingOf(room)].want = 1;
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
      s.t = 0;
      s.dur = Math.min(2.4, Math.max(FLOAT_S, s.from.distanceTo(s.to) / 14));
      [s.yawT, s.pitchT] = anglesTo(s.to, P.look);
      s.yawT = s.yaw + wrap(s.yawT - s.yaw);
    }
    walker?.stop();
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
    // Day 7 (home story, src/scene/boarding.ts): the astronaut boards the base ship, then the liftoff from the hill
    if (boarding && character) {
      if (launching) return boardFrame(dt);
      if (boardState.t0 >= 0) endBoarding();
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
    if (roomTrip.t >= 0 && roomTrip.room) {
      roomTrip.t += dt;
      if (roomTrip.dir !== 0 && roomTrip.t >= DOOR_GO) {
        const R = getRoom(roomTrip.room);
        setRoom(roomTrip.dir > 0 ? roomTrip.room : null, roomTrip.dir > 0 ? R.spawn : R.out);
        roomTrip.dir = 0;
      }
      if (roomTrip.t >= DOOR_GO + 0.9) {
        interiorDoors[buildingOf(roomTrip.room)].want = 0;
        roomTrip.t = -1;
        roomTrip.room = null;
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

  /**
   * Day 7 boarding (home story): out of any room, the rover or a trip at once, the astronaut appears a few steps from
   * the base ship's ladder (a cut: a walk from where it stood could pass through walls), walks to it, climbs, steps
   * along the porch through the hatch and is on board, hidden. The camera: a side shot of the ladder, then (on board)
   * the hill, watching the liftoff (src/scene/parts/Lander.tsx waits for it: LIFTOFF_DELAY_S).
   */
  function boardFrame(dt: number) {
    const now = performance.now() / 1000;
    if (boardState.t0 < 0) {
      boardState.t0 = now;
      if (roomState.id) setRoom(null, getRoom(roomState.id).out);
      if (seat.stage !== 'walk') leaveRover();
      if (doorTrip.t >= 0) habitatDoor.want = 0;
      if (roomTrip.room) interiorDoors[buildingOf(roomTrip.room)].want = 0;
      doorTrip.t = roomTrip.t = climb.t = -1;
      doorTrip.to = null;
      roomTrip.room = climb.to = null;
      walker?.stop();
    }
    const P = boardPose(BOARD_PATH, now - boardState.t0, boardState.pose);
    const aboard = P.stage === 'aboard';
    body.x = P.x;
    body.z = P.z;
    body.y = P.stage === 'walk' ? ground(P.x, P.z) : P.y;
    body.facing = P.facing;
    body.vx = P.vx;
    body.vz = P.vz;
    body.vy = 0;
    body.onGround = true;
    body.windup = -1;
    climbState.on = P.stage === 'climb';
    climbState.vy = P.vy;
    climbState.phase = boardClimbPhase(P.h);
    interiorDoors.lander.want = P.stage === 'porch' || P.stage === 'in' ? 1 : 0; // the hatch opens for it
    nearCam.hide = aboard;
    let look: Vec3;
    if (aboard) {
      camera.position.set(...POINTS.hill.pos);
      lander[1] = 3 + launchState.h;
      look = lander;
    } else {
      const C = BOARD_PATH.camera;
      camera.position.set(C.x, ground(C.x, C.z) + C.h, C.z);
      boardLook[0] = body.x;
      boardLook[1] = body.y + 1.2;
      boardLook[2] = body.z;
      look = boardLook;
    }
    [s.yaw, s.pitch] = anglesTo(camera.position, look);
    s.yawT = s.yaw;
    s.pitchT = s.pitch;
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ'); // no roll: horizon always level
    camState.inside = false;
    if (features.controls) setAim(null);
    setRide(null);
    c.shadowT -= dt;
    if (c.shadowT <= 0) {
      c.shadowT = SHADOW_EVERY;
      gl.shadowMap.needsUpdate = true; // the astronaut's shadow moves with it
    }
    invalidate();
  }

  /** The launch is over (the truth screen, a new game): the ladder clip and the hatch back to rest. */
  function endBoarding() {
    boardState.t0 = -1;
    climbState.on = false;
    climbState.vy = 0;
    interiorDoors.lander.want = 0;
  }

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
  function nearHatch(): number {
    hatchAt(rover, hatch, 1);
    const left = Math.hypot(body.x - hatch.x, body.z - hatch.z);
    hatchAt(rover, hatch, -1);
    const right = Math.hypot(body.x - hatch.x, body.z - hatch.z);
    return Math.min(left, right) > BOARD_REACH ? 0 : left <= right ? 1 : -1;
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
    } else if (s.t < 1) {
      // a float is one long lunar hop: glide along the line, a parabola over it, the JumpAir pose scrubbed by it
      s.t = Math.min(1, s.t + dt / s.dur);
      const t = ease(s.t);
      const dx = s.to.x - s.from.x;
      const dz = s.to.z - s.from.z;
      const d = Math.hypot(dx, dz);
      body.x = s.from.x + dx * t;
      body.z = s.from.z + dz * t;
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
    const tilt = room ? (isHduRoom(room) ? 0 : ROOM_TILT) : CAM_TILT + (CAR_TILT - CAM_TILT) * kc;
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
    // (`?hdu` only, on foot; ASTRA keeps its picture)
    nearCam.hide = HDU_HABITAT && kc === 0 && !astronautShown(Math.hypot(camera.position.x - hx, camera.position.y - hy, camera.position.z - hz));

    // E / hand button: the building in front of the astronaut (its facing, in the camera's yaw convention)
    if (features.controls) setAim(s.t < 1 || launching || seat.stage !== 'walk' || room ? null : pickAim(body.x, body.z, body.facing + Math.PI, AIM));
    // E (stored only when it changes): the rover (?drive); a building's door outside (in) or inside (out)
    const onFoot = seat.stage === 'walk' && !scripted && s.t >= 1 && walkInput.phaseOk && body.onGround && body.windup < 0;
    let ride: Ride | null = null;
    if (DRIVABLE && !room) ride = seat.stage === 'drive' ? 'exit' : onFoot && nearHatch() ? 'board' : null;
    nearDoor.id = astraLook && onFoot && !room ? doorAt(body) : null;
    if (!ride && onFoot && doorTrip.t < 0 && roomTrip.t < 0) {
      if (room && climb.t < 0) {
        if (room.exit(body.x, body.z)) ride = 'leave';
        else if (room.ladder?.near(body.x, body.z)) ride = getRoom(room.ladder.to).floorY > room.floorY ? 'up' : 'down';
      }
      else if (nearDoor.id) ride = 'enter';
    }
    setRide(ride);
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

  // (home story: once the ship has flown the astronaut is on board, not on the Moon)
  const aboard = boarding && view.launched === true && view.phase === 'truth';
  const astronaut = character ? <Astronaut body={body} visible={point !== 'inside' && !aboard} hands={view.hands ?? 0} view={view} /> : null;

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
