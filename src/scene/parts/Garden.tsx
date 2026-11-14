import { LAYOUT } from '../layout';
import { MAT } from './materials';
import type { TapHandler } from './tap';
import { Shell } from '../models/Shell';
import { Crops } from './Crops';

const BASE = 0.25;

/** Moon garden → Garden. Lettuce and tomatoes by `plant` (Crops.tsx), magenta grow bars when it has batteries. */
export function Garden({ on, plant, tap }: { on: boolean; plant: number; tap: TapHandler }) {
  const [x, z] = LAYOUT.garden;
  const p = Math.max(0, Math.min(4, Math.round(plant)));
  return (
    <group position={[x, 0, z]} onClick={tap}>
      <Shell
        name="garden"
        grey={
          <>
            <mesh position={[0, BASE / 2, 0]} material={MAT.panel} castShadow receiveShadow>
              <cylinderGeometry args={[1.3, 1.35, BASE, 32]} />
            </mesh>
            <mesh position={[0, BASE, 0]} material={MAT.dome}>
              <sphereGeometry args={[1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
          </>
        }
      />
      <Crops plant={p} on={on} base={BASE} />
    </group>
  );
}
