import { useEffect, useMemo } from 'react';
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

/**
 * Draws the body the rig moves (src/character/body.ts): position, facing, and the clip for what it does — Idle,
 * Walk (1.0 m/s) and the Apollo lope (2.0 m/s) played at the speed that keeps the boots planted, the jump in three
 * parts. Leaves boot prints and kicks dust that flies in clean arcs (no air) while it is shown.
 */
export function Astronaut({ body, visible }: { body: Body; visible: boolean }) {
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
    anim.update(dt, {
      onGround: body.onGround, windup: body.windup, vy: body.vy, v0: body.v0 || 1.2,
      speed, carrying: false, pouring: false, running: body.running, k: 1,
    });
    if (!visible) return;
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
