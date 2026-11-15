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
import { climbState } from '../walk/ladder';

/** The suited astronaut: NASA EMU model, rigged and animated by Samandar (blender/game3d/characters/), 6k triangles. */
const URL = `${import.meta.env.BASE_URL}models/astronaut/astronaut.glb`;

/** Most batteries the hands can hold (game rule HANDS_MAX in src/state/game.ts; drawn only). */
const CARRY_MAX = 4;
/** How long the Pour clip plays after batteries leave the hands (PUT), seconds. */
const POUR_S = 0.6;
/** One carried battery: a small block, stacked in front of the chest (local: +z = where the astronaut faces). */
const CELL = new THREE.BoxGeometry(0.22, 0.11, 0.15);
const CELL_MAT = new THREE.MeshStandardMaterial({ color: '#f0b43c', emissive: '#f0b43c', emissiveIntensity: 0.55, roughness: 0.5 });
const CHEST_Y = 1.02;
const CHEST_AHEAD = 0.34;

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
 * Carrying (15 Nov): with batteries in the hands (view.hands) it plays Carry / CarryIdle and holds 1–4 blocks in
 * front of the chest (one instanced mesh, one draw call); when they go into a machine it plays Pour for a moment.
 *
 * Gestures (features.gestures): a battery placed from the plan list (not carried) → the astronaut turns to the
 * building and puts a battery in from the thigh pocket (taken back → the same clip backward); Confirm → checks the wrist tablet; standing
 * still for a while → looks round the base and up at the Sun. The calm scene draws on demand, so a playing gesture
 * asks for every frame itself (.claude/rules/three.md).
 */
const seatM = new THREE.Matrix4();
const seatS = new THREE.Vector3();

export function Astronaut({ body, visible, hands = 0, view }: { body: Body; visible: boolean; hands?: number; view?: View }) {
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
          m.color.multiplyScalar(0.7);
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

  // the carried batteries: a stack of blocks, placed once; only the count and the group's place change
  const cargo = useMemo(() => {
    const group = new THREE.Group();
    const mesh = new THREE.InstancedMesh(CELL, CELL_MAT, CARRY_MAX);
    const m = new THREE.Matrix4();
    for (let i = 0; i < CARRY_MAX; i++) mesh.setMatrixAt(i, m.makeTranslation(0, i * 0.125, 0));
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { group, mesh };
  }, []);
  useEffect(() => () => cargo.mesh.dispose(), [cargo]);
  const held = useRef({ hands, pour: 0, busy: 0 });
  useEffect(() => {
    const h = held.current;
    if (hands < h.hands) h.pour = POUR_S; // batteries left the hands (into a machine)
    h.hands = hands;
    h.busy = POUR_S; // frames for the cross-fade (the scene may draw only on demand)
    invalidate();
  }, [hands, invalidate]);

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
  const prev = useRef<{ day: number; phase: string; alloc: View['alloc']; hands: number } | null>(null);
  useEffect(() => {
    if (!view) return;
    const p = prev.current;
    prev.current = { day: view.day, phase: view.phase, alloc: view.alloc, hands: view.hands ?? 0 };
    if (!features.gestures || !p || !visible || armOn()) return;
    if (p.phase === 'plan' && view.phase === 'run') {
      if (anim.gesture('Wrist')) invalidate(); // Confirm: the day's plan goes in on the wrist tablet
      return;
    }
    if (p.phase !== 'plan' || view.phase !== 'plan' || p.day !== view.day) return;
    if ((view.hands ?? 0) !== p.hands) return; // carried in or taken back by hand: Pour / Carry show it
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
    const h = held.current;
    h.pour = Math.max(0, h.pour - dt);
    if (h.busy > 0) {
      h.busy -= dt;
      invalidate();
    }
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
    // inside a building's room the astronaut is drawn at the room's scale (src/walk/rooms.ts)
    const k = seated ? 1 : body.scale;
    model.scale.setScalar(k);
    if (seated) {
      rover.object!.updateMatrixWorld(true);
      seatM.multiplyMatrices(rover.object!.matrixWorld, rover.seatLocal!);
      seatM.decompose(model.position, model.quaternion, seatS);
    } else {
      model.position.set(body.x, body.y, body.z);
      model.rotation.set(0, body.facing, 0);
    }
    const speed = seated ? 0 : Math.hypot(body.vx, body.vz) / k; // (the clips are planted at full-size speeds)
    anim.update(dt, {
      onGround: body.onGround, windup: body.windup, vy: body.vy / k, v0: body.v0 / k || 1.2,
      speed, carrying: h.hands > 0 || h.pour > 0, pouring: h.pour > 0, running: body.running, k: 1, seated, steer: rover.steerInput,
      climb: climbState.on ? climbState.phase : null, climbV: climbState.vy / k, // on the habitat's ladder (full size)
    });
    if (climbState.on) state.invalidate();
    cargo.mesh.count = model.visible && !seated ? Math.min(CARRY_MAX, h.hands) : 0;
    if (cargo.mesh.count > 0) {
      cargo.group.position.set(
        body.x + Math.sin(body.facing) * CHEST_AHEAD * k,
        body.y + (CHEST_Y - (cargo.mesh.count - 1) * 0.06) * k,
        body.z + Math.cos(body.facing) * CHEST_AHEAD * k,
      );
      cargo.group.rotation.y = body.facing;
      cargo.group.scale.setScalar(k);
    }
    armState.player.x = body.x;
    armState.player.z = body.z;
    if (remote && remote.pose(dt, armState.on && visible)) invalidate();
    if (battery) battery.visible = visible && !armOn() && anim.holdingBattery();
    if (anim.gesturing()) settle.current = 0.4;
    if (settle.current > 0) {
      settle.current -= dt;
      state.invalidate(); // demand mode: keep drawing while a gesture plays and fades back to Idle
    }
    if (!visible || k !== 1) {
      // (no boot prints or dust on a room's floor)
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

  return (
    <>
      <primitive object={model} />
      <primitive object={cargo.group} />
    </>
  );
}

useGLTF.preload(URL);
