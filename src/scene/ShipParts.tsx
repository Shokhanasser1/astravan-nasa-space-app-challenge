import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fabric } from '../vendor/astra/scene/kit';
import { PLAN } from './layout';
import { groundHeight } from './ground';
import { BAGS, PIECES, POP_S, bagsFor, partsSpot, popScale, type Finish } from './partsPile';

/**
 * The ship's parts pile beside the lander (home story; behind features.homeStory, BaseScene.tsx): a pallet and one
 * cargo bag per sixth of Ship % (View.res.ship), so the goal stands in the world. One instanced mesh, one draw call,
 * ASTRA's woven fabric in white, light grey and gold; it casts no shadow (small things never do). A new bag pops in
 * softly (scale only, no light, no flash); bags already there when the scene opens are just there.
 * Place and pieces: src/scene/partsPile.ts; its hitbox: src/walk/world.ts.
 */
const COLOR: Record<Finish | 'pallet', string> = { pallet: '#8b919a', white: '#f2f3f5', grey: '#bcc2cb', gold: '#d3a23c' };
const SPOT = partsSpot(PLAN);
const GROUND_Y = groundHeight(SPOT.x, SPOT.z);
const dummy = new THREE.Object3D();
const tint = new THREE.Color();

/** One piece's matrix at pop scale s (0…1): its bottom stays on what it stands on. */
function place(m: THREE.InstancedMesh, i: number, s: number) {
  const p = PIECES[i];
  const [w, h, d] = p.size;
  dummy.position.set(p.at[0], p.at[1] - h / 2 + (h * s) / 2, p.at[2]);
  dummy.rotation.set(0, p.turn, 0);
  dummy.scale.set(w * Math.max(s, 1e-3), h * Math.max(s, 1e-3), d * Math.max(s, 1e-3));
  dummy.updateMatrix();
  m.setMatrixAt(i, dummy.matrix);
}

export function ShipParts({ ship }: { ship: number }) {
  const want = bagsFor(ship);
  const invalidate = useThree((s) => s.invalidate);
  const mesh = useRef<THREE.InstancedMesh>(null);
  // pop[i]: piece i's pop, 0…1 (1 = in place); `shown` bags are drawn
  const st = useRef({ shown: want, pop: new Float32Array(BAGS + 1).fill(1), moving: false }).current;
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.12), []);
  const material = useMemo(() => fabric('#ffffff'), []);
  useEffect(() => () => geometry.dispose(), [geometry]); // (the material is ASTRA's shared one: never disposed)

  // every piece placed once, in its colour
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < PIECES.length; i++) {
      place(m, i, 1);
      m.setColorAt(i, tint.set(COLOR[PIECES[i].finish]));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    m.count = 1 + st.shown;
  }, [st]);

  // Ship % moved: new bags pop in (from the bottom of the pile up), fewer bags (a new game) just go
  useEffect(() => {
    const m = mesh.current;
    if (want > st.shown) {
      for (let i = st.shown + 1; i <= want; i++) st.pop[i] = 0;
      st.moving = true;
    } else {
      for (let i = want + 1; i <= BAGS; i++) st.pop[i] = 1;
    }
    st.shown = want;
    if (m) m.count = 1 + want;
    invalidate();
  }, [want, st, invalidate]);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m || !st.moving) return;
    const dt = Math.min(delta, 0.05);
    let still = false;
    for (let i = 1; i <= st.shown; i++) {
      if (st.pop[i] >= 1) continue;
      // one bag after another, 0.25 s apart: the pile grows from the bottom
      if (i > 1 && st.pop[i - 1] < 0.45) {
        place(m, i, 0);
        still = true;
        continue;
      }
      st.pop[i] = Math.min(1, st.pop[i] + dt / POP_S);
      place(m, i, popScale(st.pop[i]));
      if (st.pop[i] < 1) still = true;
    }
    m.instanceMatrix.needsUpdate = true;
    st.moving = still;
    if (still) invalidate();
    else m.computeBoundingSphere();
  });

  return (
    <group position={[SPOT.x, GROUND_Y, SPOT.z]} rotation-y={SPOT.yaw}>
      <instancedMesh ref={mesh} args={[geometry, material, PIECES.length]} name="ship_parts" receiveShadow />
    </group>
  );
}
