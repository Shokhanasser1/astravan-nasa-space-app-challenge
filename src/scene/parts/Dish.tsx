import { LAYOUT } from '../layout';
import { MAT } from './materials';

/** Dish module: not built, drawn as a faint wire outline (developer guide §06: "sim to'r"). */
export function Dish() {
  const [x, z] = LAYOUT.dish;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.8, 0]} material={MAT.wire}>
        <cylinderGeometry args={[0.1, 0.15, 1.6, 6, 1]} />
      </mesh>
      <mesh position={[0, 1.8, 0]} rotation-x={-0.6} material={MAT.wire}>
        <coneGeometry args={[1, 0.5, 16, 1, true]} />
      </mesh>
    </group>
  );
}
