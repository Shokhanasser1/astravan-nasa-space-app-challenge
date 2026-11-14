import type { Machine, View } from '../state/game';

/**
 * Lane C (Shoxjahon aka). The 3D base: renders a View, reports taps. NEVER computes game numbers.
 * PLACEHOLDER grey shapes until the skeleton is split in here: Terrain.tsx, Storm.tsx, Rig.tsx and
 * parts/{Habitat,Garden,Workshop,Lander,Scout,SolarWing,Hub,Dish}.tsx (developer guide §02, §06).
 * Positions in metres come from docs/layout.md. Only big bodies cast shadows; repeats use <Instances>.
 */
export function BaseScene({ view, onTap }: { view: View; onTap: (k: Machine) => void }) {
  const lit = (n: number) => (n > 0 ? '#ffd98a' : '#3a3f55');
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[520, 520, 1, 1]} />
        <meshStandardMaterial color="#a3a5ad" roughness={1} />
      </mesh>
      {/* habitat → life support */}
      <mesh position={[0.2, 1.8, 0.8]} castShadow onClick={() => onTap('ls')}>
        <capsuleGeometry args={[1.4, 1.2, 4, 16]} />
        <meshStandardMaterial color="#e9ecf2" roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0.2, 1.8, 2.25]}>
        <boxGeometry args={[0.6, 0.4, 0.05]} />
        <meshStandardMaterial color={lit(view.alloc.ls)} emissive={lit(view.alloc.ls)} emissiveIntensity={view.alloc.ls > 0 ? 3.2 : 0} toneMapped={false} />
      </mesh>
      {/* garden */}
      <mesh position={[-4, 1, 1]} castShadow onClick={() => onTap('gh')}>
        <sphereGeometry args={[1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e9ecf2" roughness={0.3} transparent opacity={0.6} />
      </mesh>
      {/* workshop */}
      <mesh position={[4, 0.9, 0]} castShadow onClick={() => onTap('ws')}>
        <boxGeometry args={[2.2, 1.8, 2.2]} />
        <meshStandardMaterial color="#e9ecf2" roughness={0.55} />
      </mesh>
      {/* scout → explore */}
      <mesh position={[2, 0.5, 4]} castShadow onClick={() => onTap('sc')}>
        <boxGeometry args={[1, 0.6, 1.4]} />
        <meshStandardMaterial color="#c9972b" roughness={0.38} metalness={0.85} />
      </mesh>
      {/* lander → launch */}
      <mesh position={[-2, 1.5, -5]} castShadow onClick={() => onTap('launch')}>
        <cylinderGeometry args={[1.2, 1.6, 3, 16]} />
        <meshStandardMaterial color="#c9972b" roughness={0.38} metalness={0.85} />
      </mesh>
      {/* regolith wall rings around the habitat */}
      {Array.from({ length: view.wall }, (_, i) => (
        <mesh key={i} position={[0.2, 0.15 + i * 0.3, 0.8]} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[2.4 + i * 0.25, 0.14, 8, 32]} />
          <meshStandardMaterial color="#8a7a5c" roughness={1} />
        </mesh>
      ))}
      {/* ridge on the horizon */}
      <mesh position={[-60, 6, -160]} castShadow>
        <boxGeometry args={[120, 12, 20]} />
        <meshStandardMaterial color="#6f7076" roughness={1} />
      </mesh>
    </group>
  );
}
