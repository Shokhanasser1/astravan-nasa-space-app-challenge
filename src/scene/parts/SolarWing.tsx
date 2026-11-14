import { LAYOUT } from '../layout';
import { MAT } from './materials';

/** Solar wing: two vertical panels on a boom (the Sun is low at the pole); one is bent since the landing. */
export function SolarWing() {
  const [x, z] = LAYOUT.wing;
  return (
    <group position={[x, 0, z]} rotation-y={0.5}>
      <mesh position={[0, 1.4, 0]} material={MAT.panel}>
        <cylinderGeometry args={[0.08, 0.1, 2.8, 8]} />
      </mesh>
      <mesh position={[0, 2.7, 0]} rotation-x={Math.PI / 2} material={MAT.panel}>
        <cylinderGeometry args={[0.05, 0.05, 5.4, 6]} />
      </mesh>
      <mesh position={[0, 2.0, -1.45]} material={MAT.glass} castShadow>
        <boxGeometry args={[0.05, 1.6, 2.4]} />
      </mesh>
      {/* bent at landing: tilted and drooping */}
      <mesh position={[0.25, 1.75, 1.4]} rotation={[0.35, 0, -0.45]} material={MAT.glass} castShadow>
        <boxGeometry args={[0.05, 1.6, 2.4]} />
      </mesh>
    </group>
  );
}
