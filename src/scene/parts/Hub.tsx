import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { LAYOUT, RADIUS, type XZ } from '../layout';
import { GLOW, MAT } from './materials';
import type { TapHandler } from './tap';
import * as THREE from 'three';
import { astraLook } from '../AstraBase';
import { bake } from '../astra/bake';
import { finalize } from '../../vendor/astra/scene/kit';
import { C, cabinet } from '../../vendor/astra/scene/models/common';

/** ASTRA's equipment cabinet as the hub's body (door outline, hinges, handle), baked into a few meshes. */
const cabinetBody = (() => {
  const g = new THREE.Group();
  if (!astraLook) return g;
  cabinet(g, 1.0, 0.8, 0.8, C.off);
  finalize(g);
  bake(g, { keep: [], live: [] });
  return g;
})();

/**
 * Power hub: the cabinet the batteries are taken from (E or a tap while facing it). Its battery cells — lit = free at
 * the hub, dark = on a machine or in the hands — are drawn by src/scene/Batteries.tsx with every machine's socket, so
 * all cells share one draw call. `tap` = the same as E (only when the hub is what the astronaut faces).
 */
export function Hub({ tap }: { tap?: TapHandler }) {
  const [x, z] = LAYOUT.hub;
  return (
    <group position={[x, 0, z]} rotation-y={-Math.PI / 4} onClick={tap}>
      {astraLook ? (
        <primitive object={cabinetBody} />
      ) : (
        <mesh position={[0, 0.4, 0]} material={MAT.panel} receiveShadow>
          <boxGeometry args={[1.0, 0.8, 0.8]} />
        </mesh>
      )}
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
