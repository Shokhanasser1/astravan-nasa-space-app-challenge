import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DOOR_AZ, DOOR_R, LAYOUT, PARKED_ROVER as SEV } from './layout';
import { ICE_CRATER, groundHeight, groundSurface } from './ground';
import { initialTier } from './quality';
import { softwareGl } from './rich';
import { applyRover, ARRIVE, DRIVABLE, rover, stepSuspension } from './arrival';
import { playClip } from './clip';
import { WheelTracks } from '../look/fx.js';
import { keepMarks, storedMarks } from './marks';

/** One tyre's tread width (sev.glb: 0.584 × 0.291 m scale); a wheel is two of them side by side. */
const TYRE_W = 0.17;
const tyreAt = new THREE.Vector3();

/**
 * NASA models around the base that are not machines of the week (public/models/nasa-decor, Samandar's catalog,
 * real size in metres, their own NASA textures): the crew rover parked by the base, RASSOR digging at the rim of
 * the ice crater, cargo bags at the habitat door. Each loads on its own; one that fails is simply not shown.
 * RASSOR digs (its `Dig` clip: drums turning, the front arm lowering); the crew rover is parked — its wheels and
 * bogies are separate parts with a `Drive` clip (1.0 m/s): with `?arrive` or `?drive` it goes where the shared
 * rover state says (src/scene/arrival.ts), wheels turning at its speed.
 */
const MOVES = ARRIVE || DRIVABLE;
const base = `${import.meta.env.BASE_URL}models/nasa-decor/`;
const toCrater = Math.atan2(ICE_CRATER.x, ICE_CRATER.z);
// RASSOR's digging drum is its model's -Z end: turn it round (+ pi) so it digs towards the crater.
const RASSOR = { x: ICE_CRATER.x - Math.sin(toCrater) * 27, z: ICE_CRATER.z - Math.cos(toCrater) * 27, yaw: toCrater + Math.PI };
// (just outside the habitat's regolith shield, beside the door)
const doorX = LAYOUT.habitat[0] + Math.sin(DOOR_AZ) * (DOOR_R + 0.7);
const doorZ = LAYOUT.habitat[1] + Math.cos(DOOR_AZ) * (DOOR_R + 0.7);
const BAGS: [number, number, number, number][] = [
  [doorX + Math.cos(DOOR_AZ) * 1.0, 0, doorZ - Math.sin(DOOR_AZ) * 1.0, 0.3],
  [doorX + Math.cos(DOOR_AZ) * 1.5, 0, doorZ - Math.sin(DOOR_AZ) * 1.5, -0.2],
  [doorX + Math.cos(DOOR_AZ) * 1.25, 0.24, doorZ - Math.sin(DOOR_AZ) * 1.25, 1.2],
];

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type ModelProps = {
  file: string;
  at: [number, number, number];
  yaw: number;
  shadow?: boolean;
  play?: string;
  /** follow the shared rover (src/scene/arrival.ts): its pose each frame, the Drive clip at its speed */
  drive?: boolean;
};

function Model({ file, at, yaw, shadow = true, play, drive = false }: ModelProps) {
  const { scene, animations } = useGLTF(base + file, false, true);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = shadow;
        m.receiveShadow = true;
      }
      if (m.name.startsWith('COL_')) m.visible = false; // the catalog's collider boxes are never drawn
    });
    return o;
  }, [scene, shadow]);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true; // the once-a-day shadow map must include it
    invalidate();
  }, [obj, gl, invalidate]);
  // A machine at work (the model's own clip, made in Blender: blender/decor_anim): plays while the scene renders
  // anyway — it never asks for frames itself, so a calm scene stays calm (frameloop "demand").
  const clip = useMemo(() => (play ? animations.find((c) => c.name === play) : undefined), [animations, play]);
  const mixer = useMemo(() => (clip ? new THREE.AnimationMixer(obj) : null), [obj, clip]);
  useEffect(() => (mixer && clip ? playClip(mixer, clip) : undefined), [mixer, clip]);
  // the driven rover: hand its object and parts to the shared state (steer pivots front +1 / middle 0 / rear −1,
  // the driver's seat and the cockpit camera, both relative to the rover's root)
  useEffect(() => {
    if (!drive) return;
    obj.updateMatrixWorld(true);
    const inv = obj.matrixWorld.clone().invert();
    const local = (name: string) => {
      const n = obj.getObjectByName(name);
      return n ? new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld) : null;
    };
    rover.steerParts = [];
    rover.doorParts = [];
    obj.traverse((n) => {
      const m = /^sev_steer_[LR]([123])$/.exec(n.name);
      if (m) rover.steerParts.push({ node: n, k: m[1] === '1' ? 1 : m[1] === '3' ? -1 : 0, x: n.position.x, z: n.position.z, y0: n.position.y });
      const d = /^sev_hatch_([LR])$/.exec(n.name);
      if (d) rover.doorParts.push({ node: n, side: d[1] as 'L' | 'R' });
    });
    rover.seatLocal = local('sev_seat_driver');
    rover.camLocal = local('sev_cam_cockpit');
    rover.object = obj;
    return () => {
      if (rover.object === obj) rover.object = null;
    };
  }, [obj, drive]);
  // the wheels leave tracks wherever the rover drives (the arrival, the player); they stay, like boot prints
  const world = useThree((s) => s.scene);
  // (each of the six wheels is a pair of tyres, sev_wheel_L1…L6 / R1…R6: twelve tracks)
  const tracks = useMemo(() => (drive ? new WheelTracks(gl, TYRE_W) : null), [drive, gl]);
  const tyres = useMemo(() => {
    const out: { id: string; node: THREE.Object3D; x: number; z: number }[] = [];
    if (drive) obj.traverse((n) => /^sev_wheel_[LR][1-6]$/.test(n.name) && out.push({ id: n.name, node: n, x: 0, z: 0 }));
    return out;
  }, [obj, drive]);
  useEffect(() => {
    if (!tracks) return;
    tracks.attach(world);
    tracks.restore(storedMarks('tracks'), groundSurface); // the tracks of the last visit (once per page)
    keepMarks();
    invalidate();
    return () => tracks.dispose();
  }, [tracks, world, invalidate]);
  useFrame((_, dt) => {
    if (drive) {
      if (stepSuspension(Math.min(dt, 0.05))) invalidate(); // the chassis settles on its springs
      applyRover();
      if (tracks && tyres.length && rover.speed !== 0) {
        obj.updateMatrixWorld(true); // where each tyre is now (pose and steering just applied)
        for (const t of tyres) {
          t.node.getWorldPosition(tyreAt);
          t.x = tyreAt.x;
          t.z = tyreAt.z;
        }
        if (tracks.update(tyres, groundSurface)) invalidate();
      }
      if (mixer) mixer.timeScale = rover.speed / 1.0; // the Drive clip is planted at 1.0 m/s (backing up: backwards)
    }
    mixer?.update(Math.min(dt, 0.05));
  });
  return <primitive object={obj} position={at} rotation-y={yaw} />;
}

function One(props: ModelProps) {
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Model {...props} />
      </Suspense>
    </Quiet>
  );
}

// RASSOR (12.6k triangles, ~60 m out by the ASTRA ice drill) on computers with a graphics card only: on a phone it
// is a few pixels that cost a tenth of the triangle budget (< 100k).
const farDecor = typeof window !== 'undefined' && initialTier() === 'pc' && !softwareGl();

export function Decor() {
  return (
    <group>
      <One file="sev.glb" at={[SEV.x, groundHeight(SEV.x, SEV.z), SEV.z]} yaw={SEV.yaw} play={MOVES ? 'Drive' : undefined} drive={MOVES} />
      {farDecor && <One file="rassor.glb" at={[RASSOR.x, groundHeight(RASSOR.x, RASSOR.z), RASSOR.z]} yaw={RASSOR.yaw} play="Dig" />}
      {BAGS.map(([x, y, z, yaw], i) => (
        <One key={i} file="crew-lock-bag.glb" at={[x, groundHeight(x, z) + y, z]} yaw={yaw} shadow={false} />
      ))}
    </group>
  );
}

