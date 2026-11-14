/**
 * Grey boxes for G2 ("seven days on a phone with grey boxes for the base", concept v2, section 14).
 * Asilbek replaces these with optimized GLB models (npm run glb) without changing the store contract.
 */
export function PlaceholderBase() {
  return (
    <group>
      {/* regolith */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[400, 400, 1, 1]} />
        <meshStandardMaterial color="#8a8a8a" roughness={1} />
      </mesh>
      {/* habitat */}
      <mesh position={[0, 1.2, -4]} castShadow receiveShadow>
        <cylinderGeometry args={[2, 2, 2.4, 24]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.8} />
      </mesh>
      {/* solar wing */}
      <mesh position={[5, 2.5, -6]} rotation-y={0.6} castShadow>
        <boxGeometry args={[0.1, 4, 6]} />
        <meshStandardMaterial color="#223355" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* astronaut, 2 m: casts a ~76 m shadow at 1.5° */}
      <mesh position={[-1.5, 1, -1]} castShadow>
        <capsuleGeometry args={[0.35, 1.3, 4, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {/* ridge whose shadow walks toward the wing during the week */}
      <mesh position={[-30, 4, -40]} castShadow receiveShadow>
        <boxGeometry args={[40, 8, 10]} />
        <meshStandardMaterial color="#6f6f6f" roughness={1} />
      </mesh>
    </group>
  );
}
