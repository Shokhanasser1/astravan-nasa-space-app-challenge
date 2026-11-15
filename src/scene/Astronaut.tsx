import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AnimController } from '../character/anim.js';
import type { Body } from '../character/body';
import { GRAVITY } from '../character/physics.js';
import { GroundFx } from '../look/fx.js';
import { groundHeight } from './ground';

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

/**
 * Draws the body the rig moves (src/character/body.ts): position, facing, and the clip for what it does — Idle,
 * Walk (1.0 m/s) and the Apollo lope (2.0 m/s) played at the speed that keeps the boots planted, the jump in three
 * parts. Leaves boot prints and kicks dust that flies in clean arcs (no air) while it is shown.
 * Carrying (15 Nov): with batteries in the hands (view.hands) it plays Carry / CarryIdle and holds 1–4 blocks in
 * front of the chest (one instanced mesh, one draw call); when they go into a machine it plays Pour for a moment.
 */
export function Astronaut({ body, visible, hands = 0 }: { body: Body; visible: boolean; hands?: number }) {
  const gltf = useGLTF(URL);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  const model = useMemo(() => {
    const m = clone(gltf.scene);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.frustumCulled = false; // a skinned mesh's bounds do not follow its bones
        // ASTRA's brighter light (Light.tsx, exposure 1.32) burns the white suit out: our own copy of each
        // material, a little darker, matte, less environment shine, so the folds and the pack read again.
        const mesh = o as THREE.Mesh;
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
    return m;
  }, [gltf]);
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
  const invalidate = useThree((s) => s.invalidate);
  const held = useRef({ hands, pour: 0, busy: 0 });
  useEffect(() => {
    const h = held.current;
    if (hands < h.hands) h.pour = POUR_S; // batteries left the hands (into a machine)
    h.hands = hands;
    h.busy = POUR_S; // frames for the cross-fade (the scene may draw only on demand)
    invalidate();
  }, [hands, invalidate]);

  useEffect(() => () => fx.dispose(), [fx]);
  useEffect(
    () => () => {
      anim.mixer.stopAllAction();
    },
    [anim],
  );

  // what the prints and the dust read (allocated once)
  const look = useMemo(
    () => ({ body: { pos: [0, 0, 0], onGround: true }, facing: 0, g: GRAVITY.moon, gravityKey: 'moon', groundHeight }),
    [],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    model.visible = visible;
    model.position.set(body.x, body.y, body.z);
    model.rotation.y = body.facing;
    const speed = Math.hypot(body.vx, body.vz);
    const h = held.current;
    h.pour = Math.max(0, h.pour - dt);
    if (h.busy > 0) {
      h.busy -= dt;
      invalidate();
    }
    anim.update(dt, {
      onGround: body.onGround, windup: body.windup, vy: body.vy, v0: body.v0 || 1.2,
      speed, carrying: h.hands > 0 || h.pour > 0, pouring: h.pour > 0, running: body.running, k: 1,
    });
    cargo.mesh.count = visible ? Math.min(CARRY_MAX, h.hands) : 0;
    if (cargo.mesh.count > 0) {
      cargo.group.position.set(
        body.x + Math.sin(body.facing) * CHEST_AHEAD,
        body.y + CHEST_Y - (cargo.mesh.count - 1) * 0.06,
        body.z + Math.cos(body.facing) * CHEST_AHEAD,
      );
      cargo.group.rotation.y = body.facing;
    }
    if (!visible) return;
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
