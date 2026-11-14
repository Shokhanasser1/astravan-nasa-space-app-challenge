import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { GLOW } from './materials';

/**
 * What grows in the Moon garden, as on the space station's Veggie units: lettuce heads and staked dwarf tomatoes
 * under LED grow bars (visual idea after the ASTRA trainer's greenhouse, our own code). `plant` 0–4 (engine) picks
 * the look: 0 wilted and brown, small → 4 big, deep green, red tomatoes. Scene styling only, never a game number.
 * Instanced: lettuce, tomato leaves, fruit — three draw calls, under 4k triangles.
 */
const SIZE = [0.5, 0.65, 0.8, 0.92, 1.0];
const LEAF = ['#6e5a36', '#8c8a3c', '#6fa244', '#4eae49', '#36b84e'];
const LETTUCE: [number, number][] = [
  ...Array.from({ length: 4 }, (_, i): [number, number] => [Math.sin((i * Math.PI) / 2 + 0.78) * 0.34, Math.cos((i * Math.PI) / 2 + 0.78) * 0.34]),
  ...Array.from({ length: 8 }, (_, i): [number, number] => [Math.sin((i * Math.PI) / 4 + 0.39) * 0.78, Math.cos((i * Math.PI) / 4 + 0.39) * 0.78]),
];
const STAKES: [number, number][] = [0, 1, 2, 3].map((i) => [Math.sin((i * Math.PI) / 2) * 0.55, Math.cos((i * Math.PI) / 2) * 0.55]);

/** A crinkly lettuce head: a low icosphere pushed in and out like leaves. */
function lettuceGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.18 * Math.sin(v.x * 9) * Math.cos(v.z * 9) + 0.08 * Math.sin(v.y * 13);
    v.multiplyScalar(k);
    v.y = Math.max(v.y, -0.15) * 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function Crops({ plant, on, base }: { plant: number; on: boolean; base: number }) {
  const p = Math.max(0, Math.min(4, Math.round(plant)));
  const parts = useMemo(() => {
    const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, metalness: 0 });
    const lettuce = new THREE.InstancedMesh(lettuceGeometry(), leafMat, LETTUCE.length);
    const tomatoLeaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), leafMat, STAKES.length * 5);
    const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#d2402f', roughness: 0.45 }), STAKES.length * 4);
    const stake = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), new THREE.MeshStandardMaterial({ color: '#c8c2b0', roughness: 0.8 }), STAKES.length);
    for (const m of [lettuce, tomatoLeaf, fruit, stake]) m.frustumCulled = false;
    return { lettuce, tomatoLeaf, fruit, stake, leafMat };
  }, []);
  useEffect(
    () => () => {
      for (const m of [parts.lettuce, parts.tomatoLeaf, parts.fruit, parts.stake]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    },
    [parts],
  );

  // lay the plants out for this health (once per change, not per frame)
  useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color(LEAF[p]);
    const size = SIZE[p];
    LETTUCE.forEach(([x, z], i) => {
      const r = 0.13 * size * (0.9 + ((i * 37) % 10) / 50);
      e.set(p === 0 ? 0.3 : 0, i * 1.7, 0);
      m.compose(v.set(x, base + r * 0.35, z), q.setFromEuler(e), s.set(r, r * (p === 0 ? 0.6 : 1), r));
      parts.lettuce.setMatrixAt(i, m);
      parts.lettuce.setColorAt(i, c);
    });
    const stakeH = 0.35 + 0.55 * size;
    let leaves = 0;
    let fruits = 0;
    STAKES.forEach(([x, z], i) => {
      m.compose(v.set(x, base + stakeH / 2, z), q.identity(), s.set(1, stakeH, 1));
      parts.stake.setMatrixAt(i, m);
      for (let k = 0; k < 5; k++) {
        const h = base + 0.12 + (k / 4) * (stakeH - 0.1) * (p === 0 ? 0.5 : 1);
        const a = k * 2.1 + i;
        const r = 0.09 * size * (1 - k * 0.08);
        m.compose(v.set(x + Math.sin(a) * 0.06, h, z + Math.cos(a) * 0.06), q.setFromEuler(e.set(a, a, 0)), s.set(r, r * 0.7, r));
        parts.tomatoLeaf.setMatrixAt(leaves, m);
        parts.tomatoLeaf.setColorAt(leaves++, c);
      }
      const ripe = p >= 4 ? 4 : p === 3 ? 2 : 0;
      for (let k = 0; k < ripe; k++) {
        const a = k * 1.6 + i * 0.7;
        m.compose(v.set(x + Math.sin(a) * 0.09, base + 0.25 + k * 0.12 * size, z + Math.cos(a) * 0.09), q.identity(), s.setScalar(0.04));
        parts.fruit.setMatrixAt(fruits++, m);
      }
    });
    parts.tomatoLeaf.count = leaves;
    parts.fruit.count = fruits;
    for (const im of [parts.lettuce, parts.tomatoLeaf, parts.fruit, parts.stake]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }, [p, base, parts]);

  return (
    <group>
      <primitive object={parts.lettuce} />
      <primitive object={parts.tomatoLeaf} />
      <primitive object={parts.fruit} />
      <primitive object={parts.stake} />
      {/* LED grow bars across the dome: magenta when the garden has batteries */}
      {[-0.32, 0.32].map((dx) => (
        <mesh key={dx} position={[dx, 1.12, 0]} material={on ? GLOW.grow : GLOW.dark}>
          <boxGeometry args={[0.05, 0.025, 1.5]} />
        </mesh>
      ))}
    </group>
  );
}
