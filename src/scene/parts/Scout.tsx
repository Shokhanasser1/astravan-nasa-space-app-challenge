import { Instance, Instances } from '@react-three/drei';
import { LAYOUT } from '../layout';
import { GLOW, MAT } from './materials';
import type { TapHandler } from './tap';

const WHEELS: [number, number][] = [
  [-0.58, -0.5],
  [0.58, -0.5],
  [-0.58, 0.5],
  [0.58, 0.5],
];

/** Scout rover → Explore. Mast up, eye glows when it has batteries. Faces the base (north). */
export function Scout({ on, tap }: { on: boolean; tap: TapHandler }) {
  const [x, z] = LAYOUT.scout;
  return (
    <group position={[x, 0, z]} onClick={tap}>
      <mesh position={[0, 0.55, 0]} material={MAT.panel} castShadow receiveShadow>
        <boxGeometry args={[1, 0.45, 1.4]} />
      </mesh>
      <Instances limit={4} material={MAT.glass} frustumCulled={false}>
        <cylinderGeometry args={[0.22, 0.22, 0.15, 14]} />
        {WHEELS.map(([wx, wz]) => (
          <Instance key={`${wx}${wz}`} position={[wx, 0.22, wz]} rotation={[0, 0, Math.PI / 2]} />
        ))}
      </Instances>
      <mesh position={[0, 1.2, -0.45]} material={MAT.panel}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 6]} />
      </mesh>
      <mesh position={[0, 1.68, -0.5]} material={on ? GLOW.eye : GLOW.dark}>
        <boxGeometry args={[0.26, 0.14, 0.12]} />
      </mesh>
    </group>
  );
}
