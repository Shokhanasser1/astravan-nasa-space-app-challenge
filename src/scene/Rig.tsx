import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { View } from '../state/game';
import { camState, gesture, launchState } from './anim';
import { DOOR_AZ, LAYOUT, RADIUS } from './layout';
import { EYE, FOCUS, POINTS, phasePoint, type PointId, type Vec3 } from './points';
import { GLOW } from './parts/materials';
import { TAP_PX, tapOnly } from './parts/tap';
import { groundHeight } from './ground';
import { freeWalk } from '../walk/enabled';
import { axes, listenKeys, running, walkInput, type Axes } from '../walk/input';
import { heading } from '../walk/move';
import { createWalker, walkDebug } from '../walk/walker';
import { clearance, type XZ } from '../walk/collide';
import { INSIDE, OUTSIDE } from '../walk/world';
import { features } from '../config/features';
import { pickAim, type AimTarget } from '../controls/aim';
import { onTravel, setAim } from '../controls/bus';
import { STEP, createBody, stepBody } from '../character/body';
import { telemetry } from '../character/telemetry';
import { Astronaut } from './Astronaut';

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
 */
const character = features.character || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('character'));
const HEAD = 1.55; // the camera aims at the helmet
const CAM_DIST = 4.6;
const CAM_TILT = 0.22; // rad: the follow camera looks a little down on the astronaut
const ground = (x: number, z: number) => groundHeight(x, z);
const reduced = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const MAX_PITCH = THREE.MathUtils.degToRad(35);
const MAX_TURN = THREE.MathUtils.degToRad(reduced ? 40 : 60); // rad/s, motion-sickness rule
const FLOAT_S = reduced ? 1.4 : 1.0;
const DRAG_RAD_PER_PX = 0.0045;

const lander: Vec3 = [LAYOUT.lander[0], 3, LAYOUT.lander[1]];

/** What E (or the ✋ button, or a tap) acts on: the power hub and the machines, at their footprint (src/controls/aim.ts). */
const AIM: AimTarget[] = [
  { k: 'hub', x: LAYOUT.hub[0], z: LAYOUT.hub[1], r: RADIUS.hub },
  { k: 'ls', x: LAYOUT.habitat[0], z: LAYOUT.habitat[1], r: RADIUS.habitat },
  { k: 'gh', x: LAYOUT.garden[0], z: LAYOUT.garden[1], r: RADIUS.garden },
  { k: 'ws', x: LAYOUT.workshop[0], z: LAYOUT.workshop[1], r: RADIUS.workshop },
  { k: 'sc', x: LAYOUT.scout[0], z: LAYOUT.scout[1], r: RADIUS.scout },
  { k: 'launch', x: LAYOUT.lander[0], z: LAYOUT.lander[1], r: RADIUS.lander },
];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clampAbs = (v: number, m: number) => Math.max(-m, Math.min(m, v));

function anglesTo(from: THREE.Vector3, look: Vec3): [number, number] {
  const dx = look[0] - from.x;
  const dy = look[1] - from.y;
  const dz = look[2] - from.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return [yaw, Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch))];
}

export function Rig({ view }: { view: View }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const [point, setPoint] = useState<PointId>(() => phasePoint(view.phase) ?? 'hub');
  // Free walk: `hop` asks for a float even to the point you last stood at (you may have walked away from it).
  const [hop, setHop] = useState(0);
  const walker = useMemo(() => (freeWalk && !character ? createWalker() : null), []);
  const body = useMemo(() => createBody(POINTS.hub.pos[0], POINTS.hub.pos[2], ground), []);
  const c = useRef({ acc: 0, quiet: 0, shadowT: 0, takeoff: NaN, peak: 0, ax: { ahead: 0, side: 0, turn: 0 } as Axes, wish: { x: 0, z: 0 } as XZ }).current;
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

  // Phase → default point (run and unknown phases: stay).
  useEffect(() => {
    const p = phasePoint(view.phase);
    if (p) {
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

  const launching = view.phase === 'launch';

  // Third person: outside, on the ground (not inside the habitat, not the truth pull-back from orbit).
  const third = character && point !== 'inside' && point !== 'orbit';

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
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
      if (walker && walkInput.phaseOk) {
        // Walk on from the point: the standing spot itself moves, and solid things stop it (src/walk/).
        const inside = point === 'inside';
        walking = walker.step(s.to, s.yaw, inside ? INSIDE : OUTSIDE, dt);
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
    camState.inside = Math.hypot(camera.position.x - hx, camera.position.z - hz) < 1.6 && camera.position.y < 3;
    // E / ✋: which building is in front (stored only when it changes; nothing while floating or lifting off).
    if (features.controls) setAim(s.t < 1 || launching ? null : pickAim(camera.position.x, camera.position.z, s.yaw, AIM));
    if (s.t < 1 || Math.abs(dy) > 1e-3 || Math.abs(dp) > 1e-3 || launching || walking) invalidate();
  });

  /** The astronaut's frame: hop to a new point, or walk; then the follow camera behind it. */
  function followAstronaut(dt: number) {
    let active = false;
    if (s.t < 1) {
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
    } else if (walkInput.phaseOk) {
      axes(c.ax);
      heading(s.yaw, c.ax.ahead, c.ax.side, c.wish);
      s.yawT -= c.ax.turn * MAX_TURN * dt; // → turns right (yaw grows to the left)
      c.acc = Math.min(c.acc + dt, 0.1);
      while (c.acc >= STEP) {
        c.acc -= STEP;
        const air = !body.onGround;
        active = stepBody(body, { x: c.wish.x, z: c.wish.z, run: running(), jump: walkInput.jump }, OUTSIDE, ground) || active;
        walkInput.jump = false;
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

    const dy = s.yawT - s.yaw;
    const dp = s.pitchT - s.pitch;
    const k = 1 - Math.exp(-6 * dt);
    s.yaw += clampAbs(dy * k, MAX_TURN * dt);
    s.pitch += clampAbs(dp * k, MAX_TURN * dt);

    // follow camera: behind and a little above the helmet, pulled in front of anything solid, never under the ground
    const pitch = Math.max(-MAX_PITCH - CAM_TILT, s.pitch - CAM_TILT);
    const fx = -Math.sin(s.yaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = -Math.cos(s.yaw) * Math.cos(pitch);
    const hx = body.x;
    const hy = body.y + HEAD;
    const hz = body.z;
    let dist = CAM_DIST;
    for (let d = 0.6; d <= CAM_DIST; d += 0.2) {
      const px = hx - fx * d;
      const py = hy - fy * d;
      const pz = hz - fz * d;
      if (py < 3.2 && OUTSIDE.solids.some((o) => clearance(o, px, pz, 0.2) < 0)) {
        dist = Math.max(0.8, d - 0.3);
        break;
      }
    }
    camera.position.set(hx - fx * dist, hy - fy * dist, hz - fz * dist);
    camera.position.y = Math.max(camera.position.y, ground(camera.position.x, camera.position.z) + 0.3);
    camera.rotation.set(pitch, s.yaw, 0, 'YXZ'); // no roll: horizon always level
    camState.inside = false;

    // E / hand button: the building in front of the astronaut (its facing, in the camera's yaw convention)
    if (features.controls) setAim(s.t < 1 || launching ? null : pickAim(body.x, body.z, body.facing + Math.PI, AIM));
    // the Sun's shadow map is drawn once a day; while the astronaut moves, redraw it ten times a second
    c.shadowT -= dt;
    if (active && c.shadowT <= 0) {
      c.shadowT = 0.1;
      gl.shadowMap.needsUpdate = true;
    }
    c.quiet = active ? 0.6 : Math.max(0, c.quiet - dt);
    if (active || c.quiet > 0 || Math.abs(dy) > 1e-3 || Math.abs(dp) > 1e-3 || launching) invalidate();
  }

  // The glowing ground markers are gone (15 Nov, "make it a game"): you walk, the base map (M) floats you to a
  // standing point, and each phase still moves you on by itself. Only the habitat door stays tappable.
  const goInside = useMemo(
    () =>
      tapOnly(() => {
        setPoint('inside');
        setHop((h) => h + 1);
      }),
    [],
  );
  const door: Vec3 = [LAYOUT.habitat[0] + Math.sin(DOOR_AZ) * 1.73, 1.1, LAYOUT.habitat[1] + Math.cos(DOOR_AZ) * 1.73];
  const hideMarkers = launching || view.phase === 'truth';

  const astronaut = character ? <Astronaut body={body} visible={point !== 'inside'} hands={view.hands ?? 0} /> : null;

  return hideMarkers ? (
    astronaut
  ) : (
    <group>
      {astronaut}
      {point !== 'inside' && (
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
