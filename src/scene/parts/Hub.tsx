import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { LAYOUT, RADIUS, type XZ } from '../layout';
import { GLOW, MAT } from './materials';

/**
 * Power hub: one lamp per battery of the day (lit = still to place, dark = placed). At least six lamps;
 * the count and the lit number come from view.batteries (the engine), never from the scene.
 */
export function Hub({ batteries }: { batteries?: { left: number; total: number } }) {
  const [x, z] = LAYOUT.hub;
  const total = Math.max(6, Math.min(10, batteries?.total ?? 6));
  const left = Math.max(0, Math.min(total, batteries?.left ?? 0));
  const spots = Array.from({ length: total }, (_, i) => {
    const row = i < 5 ? 0 : 1;
    const col = row === 0 ? i : i - 5;
    return [-0.36 + col * 0.18, 0.86, -0.15 + row * 0.3] as const;
  });
  return (
    <group position={[x, 0, z]} rotation-y={-Math.PI / 4}>
      <mesh position={[0, 0.4, 0]} material={MAT.panel} receiveShadow>
        <boxGeometry args={[1.0, 0.8, 0.8]} />
      </mesh>
      <Instances limit={10} material={GLOW.cableOn} frustumCulled={false}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 10]} />
        {spots.slice(0, left).map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <Instances limit={10} material={GLOW.cableOff} frustumCulled={false}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 10]} />
        {spots.slice(left).map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
    </group>
  );
}

type Alloc = { ls: number; gh: number; ws: number; sc: number; launch: number };

const ENDS: { k: keyof Alloc; at: XZ; r: number }[] = [
  { k: 'ls', at: LAYOUT.habitat, r: RADIUS.habitat },
  { k: 'gh', at: LAYOUT.garden, r: RADIUS.garden },
  { k: 'ws', at: LAYOUT.workshop, r: RADIUS.workshop },
  { k: 'sc', at: LAYOUT.scout, r: RADIUS.scout },
  { k: 'launch', at: LAYOUT.lander, r: RADIUS.lander },
];

/** Ground cables from the hub to each machine; a cable glows while its machine has batteries. */
export function Cables({ alloc }: { alloc: Alloc }) {
  const segs = useMemo(
    () =>
      ENDS.map(({ k, at, r }) => {
        const dx = at[0] - LAYOUT.hub[0];
        const dz = at[1] - LAYOUT.hub[1];
        const len = Math.hypot(dx, dz);
        const a = RADIUS.hub / len;
        const b = 1 - r / len;
        const mid: [number, number, number] = [LAYOUT.hub[0] + (dx * (a + b)) / 2, 0.04, LAYOUT.hub[1] + (dz * (a + b)) / 2];
        return { k, mid, len: len * (b - a), yaw: Math.atan2(dx, dz) };
      }),
    [],
  );
  const lit = segs.filter((s) => alloc[s.k] > 0);
  const dark = segs.filter((s) => !(alloc[s.k] > 0));
  const draw = (list: typeof segs) =>
    list.map((s) => <Instance key={s.k} position={s.mid} rotation={[0, s.yaw, 0]} scale={[1, 1, s.len]} />);
  return (
    <>
      <Instances limit={5} material={GLOW.cableOn} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.05, 1]} />
        {draw(lit)}
      </Instances>
      <Instances limit={5} material={GLOW.cableOff} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.05, 1]} />
        {draw(dark)}
      </Instances>
    </>
  );
}
