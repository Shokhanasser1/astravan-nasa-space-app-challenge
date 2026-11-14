import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import type { View } from '../state/game';
import { camState, gesture, launchState } from './anim';
import { DOOR_AZ, LAYOUT, RADIUS } from './layout';
import { EYE, FOCUS, MARKERS, POINTS, phasePoint, type PointId, type Vec3 } from './points';
import { GLOW } from './parts/materials';
import { TAP_PX, tapOnly } from './parts/tap';
import { groundHeight } from './ground';
import { freeWalk } from '../walk/enabled';
import { listenKeys, walkInput } from '../walk/input';
import { createWalker, walkDebug } from '../walk/walker';
import { INSIDE, OUTSIDE } from '../walk/world';
import { features } from '../config/features';
import { pickAim, type AimTarget } from '../controls/aim';
import { onTravel, setAim } from '../controls/bus';

/**
 * First-person rig (final version, Dizayn 2.0). Eye 1.7 m; six standing points + inside; one-finger drag looks
 * around (yaw free, pitch ±35°); tap a glowing marker to float there in ~1 s; never teleports, never rolls, no shake.
 * The point and the angles are scene-local refs/state, never part of the View.
 *
 * Free walk (features.freeWalk, or ?walk in the address; src/walk/): once the camera has arrived at a point, W A S D,
 * the arrows or the touch stick walk on from it, stopped by the base's hitboxes. The points, the markers and the
 * floats all stay; a float always wins over the keys. Same motion-sickness rules: no bob, no roll, turn ≤ 60°/s.
 */
const reduced = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const MAX_PITCH = THREE.MathUtils.degToRad(35);
const MAX_TURN = THREE.MathUtils.degToRad(reduced ? 40 : 60); // rad/s, motion-sickness rule
const FLOAT_S = reduced ? 1.4 : 1.0;
const DRAG_RAD_PER_PX = 0.0045;

const lander: Vec3 = [LAYOUT.lander[0], 3, LAYOUT.lander[1]];

/** Buildings E (or the ✋ button) can put a battery on: the tappable ones, at their footprint (src/controls/aim.ts). */
const AIM: AimTarget[] = [
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
  // Free walk: `hop` asks for a float even to the point you last stood at (you may have walked away from it), and
  // `roaming` says you have, so that point's marker shows again.
  const [hop, setHop] = useState(0);
  const [roaming, setRoaming] = useState(false);
  const walker = useMemo(() => (freeWalk ? createWalker() : null), []);
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
      if (walker) setHop((h) => h + 1);
    }
    // No walking while the lander lifts off or the truth sequence plays.
    walkInput.phaseOk = view.phase !== 'launch' && view.phase !== 'truth';
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
  useEffect(() => (walker ? listenKeys(invalidate) : undefined), [walker, invalidate]);

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
    } else {
      s.from.copy(camera.position);
      s.t = 0;
      s.dur = Math.min(2.4, Math.max(FLOAT_S, s.from.distanceTo(s.to) / 14));
      [s.yawT, s.pitchT] = anglesTo(s.to, P.look);
      s.yawT = s.yaw + wrap(s.yawT - s.yaw);
    }
    walker?.stop();
    setRoaming(false);
    invalidate();
  }, [point, hop, camera, invalidate, s, walker]);

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
        s.yawT += (e.clientX - lx) * DRAG_RAD_PER_PX;
        s.pitchT = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitchT + (e.clientY - ly) * DRAG_RAD_PER_PX));
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

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
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
        s.yawT += walker.turn() * MAX_TURN * dt;
        walkDebug.inside = inside;
        // (Once, not every frame: the marker of the point you left comes back.)
        if (!roaming && !inside && Math.hypot(s.to.x - POINTS[point].pos[0], s.to.z - POINTS[point].pos[2]) > 1.2) setRoaming(true);
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

  const go = useMemo(
    () =>
      Object.fromEntries(
        [...MARKERS, 'inside'].map((p) => [
          p,
          tapOnly(() => {
            setPoint(p as PointId);
            setHop((h) => h + 1);
          }),
        ]),
      ),
    [],
  );
  const shown = MARKERS.filter((p) => roaming || p !== point);
  const floor = (p: PointId) => POINTS[p].pos[1] - EYE;
  const door: Vec3 = [LAYOUT.habitat[0] + Math.sin(DOOR_AZ) * 1.73, 1.1, LAYOUT.habitat[1] + Math.cos(DOOR_AZ) * 1.73];
  const hideMarkers = launching || view.phase === 'truth';

  return hideMarkers ? null : (
    <group>
      <Instances limit={MARKERS.length} material={GLOW.marker} frustumCulled={false}>
        <ringGeometry args={[0.42, 0.55, 32]} />
        {shown.map((p) => (
          <Instance key={p} position={[POINTS[p].pos[0], floor(p) + 0.04, POINTS[p].pos[2]]} rotation={[-Math.PI / 2, 0, 0]} />
        ))}
      </Instances>
      <Instances limit={MARKERS.length} material={GLOW.marker} frustumCulled={false}>
        <coneGeometry args={[0.16, 0.3, 4]} />
        {shown.map((p) => (
          <Instance key={p} position={[POINTS[p].pos[0], floor(p) + 1.0, POINTS[p].pos[2]]} rotation={[Math.PI, 0, 0]} />
        ))}
      </Instances>
      {shown.map((p) => (
        // Invisible tap target (material.visible = false: raycast but no draw call), bigger than the glow.
        <mesh key={p} position={[POINTS[p].pos[0], floor(p) + 0.9, POINTS[p].pos[2]]} onClick={go[p]}>
          <cylinderGeometry args={[0.8, 0.8, 1.8, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}
      {point !== 'inside' && (
        <group position={door} rotation-y={DOOR_AZ}>
          <mesh scale={[0.68, 1.32, 1]} material={GLOW.marker}>
            <ringGeometry args={[0.64, 0.7, 4, 1, Math.PI / 4]} />
          </mesh>
          {/* tap target: the whole door, invisible */}
          <mesh position-z={0.05} onClick={go.inside}>
            <planeGeometry args={[1.0, 1.9]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

