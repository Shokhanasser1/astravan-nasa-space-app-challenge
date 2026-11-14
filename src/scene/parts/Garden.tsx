import { Instance, Instances } from '@react-three/drei';
import { LAYOUT } from '../layout';
import { GLOW, MAT } from './materials';
import type { TapHandler } from './tap';

// Plant look per garden health 0..4 (0 wilted and brown, 4 tall with fruit). Scene styling, not a game number.
const HEIGHT = [0.12, 0.28, 0.45, 0.62, 0.78];
const COLOR = ['#5a4630', '#7a7a3a', '#6a9a45', '#4fa84a', '#3fb84f'];
const SPOTS: [number, number][] = [
  ...Array.from({ length: 4 }, (_, i): [number, number] => [Math.sin((i * Math.PI) / 2) * 0.32, Math.cos((i * Math.PI) / 2) * 0.32]),
  ...Array.from({ length: 8 }, (_, i): [number, number] => [Math.sin((i * Math.PI) / 4 + 0.4) * 0.72, Math.cos((i * Math.PI) / 4 + 0.4) * 0.72]),
];
const BASE = 0.25;

/** Moon garden → Garden. Plants by `plant`, pink grow light when it has batteries. Only the base ring casts a shadow. */
export function Garden({ on, plant, tap }: { on: boolean; plant: number; tap: TapHandler }) {
  const [x, z] = LAYOUT.garden;
  const p = Math.max(0, Math.min(4, Math.round(plant)));
  const h = HEIGHT[p];
  return (
    <group position={[x, 0, z]} onClick={tap}>
      <mesh position={[0, BASE / 2, 0]} material={MAT.panel} castShadow receiveShadow>
        <cylinderGeometry args={[1.3, 1.35, BASE, 32]} />
      </mesh>
      <Instances limit={SPOTS.length} frustumCulled={false}>
        <coneGeometry args={[0.09, 1, 6]} />
        <meshStandardMaterial roughness={0.8} />
        {SPOTS.map(([px, pz], i) => (
          <Instance
            key={i}
            position={[px, BASE + h / 2, pz]}
            scale={[1, h, 1]}
            rotation={[0, 0, p === 0 ? 0.7 : 0]}
            color={COLOR[p]}
          />
        ))}
      </Instances>
      {p === 4 && (
        <Instances limit={SPOTS.length} frustumCulled={false}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color="#d0453a" roughness={0.6} />
          {SPOTS.map(([px, pz], i) => (i % 2 === 0 ? <Instance key={i} position={[px + 0.06, BASE + h * 0.7, pz]} /> : null))}
        </Instances>
      )}
      <mesh position={[0, 1.15, 0]} rotation-x={-Math.PI / 2} material={on ? GLOW.grow : GLOW.dark}>
        <torusGeometry args={[0.45, 0.025, 6, 24]} />
      </mesh>
      <mesh position={[0, BASE, 0]} material={MAT.dome}>
        <sphereGeometry args={[1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}
