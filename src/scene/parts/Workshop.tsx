import { LAYOUT } from '../layout';
import { GLOW, MAT } from './materials';
import type { TapHandler } from './tap';

/** Workshop → Workshop (wall levels). The roof lamp glows when it has batteries. */
export function Workshop({ on, tap }: { on: boolean; tap: TapHandler }) {
  const [x, z] = LAYOUT.workshop;
  return (
    <group position={[x, 0, z]} onClick={tap}>
      <mesh position={[0, 0.9, 0]} material={MAT.panel} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.8, 2.2]} />
      </mesh>
      <mesh position={[0, 1.86, 0]} material={MAT.gold}>
        <boxGeometry args={[2.3, 0.12, 2.3]} />
      </mesh>
      <mesh position={[-1.105, 0.75, 0]} rotation-y={-Math.PI / 2} material={MAT.glass}>
        <planeGeometry args={[1.1, 1.4]} />
      </mesh>
      <mesh position={[-0.6, 2.02, 0.6]} material={on ? GLOW.cableOn : GLOW.dark}>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
      </mesh>
    </group>
  );
}
