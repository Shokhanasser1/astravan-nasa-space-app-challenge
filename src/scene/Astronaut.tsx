import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AnimController } from '../character/anim.js';
import type { Body } from '../character/body';
import { GRAVITY } from '../character/physics.js';
import { GroundFx } from '../look/fx.js';
import { features } from '../config/features';
import type { Machine, View } from '../state/game';
import { groundHeight } from './ground';
import { LAYOUT } from './layout';
import { Remote } from '../arm/remote';
import { armState } from '../arm/state';
import { rover } from './arrival';

/** The suited astronaut: NASA EMU model, rigged and animated by Samandar (blender/game3d/characters/), 6k triangles. */
const URL = `${import.meta.env.BASE_URL}models/astronaut/astronaut.glb`;

/** Where each battery-taking building stands (the astronaut turns to it when it is near enough). */
const SITE: Record<Machine, readonly [number, number]> = {
  ls: LAYOUT.habitat,
  gh: LAYOUT.garden,
  ws: LAYOUT.workshop,
  sc: LAYOUT.scout,
  launch: LAYOUT.lander,
};
const MACHINES = Object.keys(SITE) as Machine[];
const TURN_NEAR = 14; // m: farther than this, the battery goes in where the astronaut stands (a tap from afar)
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** The robot arm's remote owns the right arm while its scanner is on (src/arm/remote.ts): no gestures then. */
const armOn = (): boolean => armState.on;

/**
 * Draws the body the rig moves (src/character/body.ts): position, facing, and the clip for what it does — Idle,
 * Walk (1.0 m/s) and the Apollo lope (2.0 m/s) played at the speed that keeps the boots planted, the jump in three
 * parts. Leaves boot prints and kicks dust that flies in clean arcs (no air) while it is shown.
 *
 * Gestures (features.gestures): a battery placed on a building in the plan → the astronaut turns to it and puts a
 * battery in from the thigh pocket (taken back → the same clip backward); Confirm → checks the wrist tablet; standing
 * still for a while → looks round the base and up at the Sun. The calm scene draws on demand, so a playing gesture
 * asks for every frame itself (.claude/rules/three.md).
 */
const seatM = new THREE.Matrix4();
const seatS = new THREE.Vector3();

export function Astronaut({ body, visible, view }: { body: Body; visible: boolean; view?: View }) {
  const gltf = useGLTF(URL);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const model = useMemo(() => {
    const m = clone(gltf.scene);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.frustumCulled = false; // a skinned mesh's bounds do not follow its bones
        // ASTRA's brighter light (Light.tsx, exposure 1.32) burns the white suit out: our own copy of each
        // material, a little darker, matte, less environment shine, so the folds and the pack read again.
        const mesh = o as THREE.Mesh;
        if (mesh.name === 'Battery' || mesh.parent?.name === 'Battery') return; // the prop keeps its own look
        const src = mesh.material as THREE.MeshStandardMaterial;
        if (src?.isMeshStandardMaterial) {
          const m = src.clone();
          m.color.multiplyScalar(0.8);
          m.roughness = Math.max(m.roughness, 0.65);
          m.envMapIntensity = 0.35;
          mesh.material = m;
        }
      }
    });
    const battery = m.getObjectByName('Battery');
    if (battery) battery.visible = false; // shown only while it is in the glove (Insert)
    return m;
  }, [gltf]);
  const battery = useMemo(() => model.getObjectByName('Battery') ?? null, [model]);
  const anim = useMemo(
    () => new AnimController(model, Object.fromEntries(gltf.animations.map((c) => [c.name, c]))),
    [model, gltf],
  );
  const fx = useMemo(() => new GroundFx(scene, gl), [scene, gl]);
  useEffect(() => () => fx.dispose(), [fx]);
  // the robot arm's remote in the right hand while its scanner is on (src/arm/remote.ts)
  const remote = useMemo(() => (features.robotArm ? new Remote(scene, model) : null), [scene, model]);
  useEffect(() => () => remote?.dispose(), [remote]);
  useEffect(
    () => () => {
      anim.mixer.stopAllAction();
    },
    [anim],
  );

  // Gestures from what the player does (the View), never from game numbers: a battery in or out, Confirm.
  const turn = useRef<number | null>(null); // facing to turn to while putting a battery in
  const settle = useRef(0); // s of frames still asked for after a gesture (the fade back to Idle)
  const live = useRef({ visible, phase: view?.phase });
  live.current.visible = visible;
  live.current.phase = view?.phase;
  const prev = useRef<{ day: number; phase: string; alloc: View['alloc'] } | null>(null);
  useEffect(() => {
    if (!view) return;
    const p = prev.current;
    prev.current = { day: view.day, phase: view.phase, alloc: view.alloc };
    if (!features.gestures || !p || !visible || armOn()) return;
    if (p.phase === 'plan' && view.phase === 'run') {
      if (anim.gesture('Wrist')) invalidate(); // Confirm: the day's plan goes in on the wrist tablet
      return;
    }
    if (p.phase !== 'plan' || view.phase !== 'plan' || p.day !== view.day) return;
    for (const k of MACHINES) {
      const d = view.alloc[k] - p.alloc[k];
      if (d === 0) continue;
      if (anim.gesture('Insert', d < 0)) {
        const [x, z] = SITE[k];
        const near = Math.hypot(x - body.x, z - body.z) < TURN_NEAR;
        turn.current = near ? Math.atan2(x - body.x, z - body.z) : null;
        invalidate();
      }
      break;
    }
  }, [view, visible, anim, body, invalidate]);

  // Standing still a while → look around (checked once a second; the calm scene is not drawing then).
  useEffect(() => {
    if (!features.gestures) return;
    const id = setInterval(() => {
      const { visible: v, phase } = live.current;
      if (v && phase !== 'launch' && phase !== 'truth' && !armOn() && anim.fidget()) invalidate();
    }, 1000);
    return () => clearInterval(id);
  }, [anim, invalidate]);

  // what the prints and the dust read (allocated once)
  const look = useMemo(
    () => ({
      body: { pos: [0, 0, 0], onGround: true },
      facing: 0,
      g: GRAVITY.moon,
      gravityKey: 'moon',
      groundHeight,
      footfalls: anim.footfalls, // boot prints exactly where the animated boots are planted
    }),
    [anim],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    if (turn.current !== null) {
      if (anim.gesturing('Insert') && Math.hypot(body.vx, body.vz) < 0.15) {
        body.facing += wrap(turn.current - body.facing) * Math.min(1, 6 * dt); // the rig only turns a moving body
      } else {
        turn.current = null;
      }
    }
    // ?drive: at the controls the astronaut sits in the driver's seat (seen through the windows and from the cockpit
    // camera); on the arrival it rides inside unseen until it hops out
    const seated =
      rover.crew && rover.driver === 'player' && rover.object !== null && rover.seatLocal !== null && !!(anim.actions as Record<string, unknown>).SeatedSteer;
    model.visible = visible && (!rover.crew || seated);
    if (seated) {
      rover.object!.updateMatrixWorld(true);
      seatM.multiplyMatrices(rover.object!.matrixWorld, rover.seatLocal!);
      seatM.decompose(model.position, model.quaternion, seatS);
    } else {
      model.position.set(body.x, body.y, body.z);
      model.rotation.set(0, body.facing, 0);
    }
    const speed = seated ? 0 : Math.hypot(body.vx, body.vz);
    anim.update(dt, {
      onGround: body.onGround, windup: body.windup, vy: body.vy, v0: body.v0 || 1.2,
      speed, carrying: false, pouring: false, running: body.running, k: 1, seated, steer: rover.steerInput,
    });
    armState.player.x = body.x;
    armState.player.z = body.z;
    if (remote && remote.pose(dt, armState.on && visible)) invalidate();
    if (battery) battery.visible = visible && !armOn() && anim.holdingBattery();
    if (anim.gesturing()) settle.current = 0.4;
    if (settle.current > 0) {
      settle.current -= dt;
      state.invalidate(); // demand mode: keep drawing while a gesture plays and fades back to Idle
    }
    if (!visible) {
      anim.footfalls.length = 0;
      return;
    }
    look.body.pos[0] = body.x;
    look.body.pos[1] = body.y;
    look.body.pos[2] = body.z;
    look.body.onGround = body.onGround;
    look.facing = body.facing;
    fx.update(dt, look);
  });

  return <primitive object={model} />;
}

useGLTF.preload(URL);
