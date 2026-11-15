import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { LAYOUT, RADIUS } from '../layout';
import { GLOW, MAT } from './materials';
import type { TapHandler } from './tap';
import { Shell, type NodeRef } from '../models/Shell';
import { yaw } from '../models/kit';
import { AstraLab, astraLook, faceCentre } from '../AstraBase';

/**
 * Workshop → Workshop (wall levels). The roof lamp glows when it has batteries. With the NASA model the robot `arm`
 * works (yaw ±26° about its shoulder) while it has batteries and the scene clock runs; it never asks for frames.
 */
export function Workshop({ on, tap }: { on: boolean; tap: TapHandler }) {
  const [x, z] = LAYOUT.workshop;
  const arm = useRef<THREE.Object3D | null>(null);
  const nodes = useRef<Record<string, NodeRef>>({ arm }).current;
  const t = useRef(0);
  useFrame((state, delta) => {
    const a = arm.current;
    if (!a || !on || state.frameloop !== 'always') return;
    t.current += Math.min(delta, 0.05);
    yaw(a, 0.45 * Math.sin(0.8 * t.current));
  });
  return (
    <group position={[x, 0, z]} onClick={tap}>
      {astraLook ? (
        <AstraLab on={on} turn={faceCentre(x, z)} />
      ) : (
        <group scale={RADIUS.workshop / 1.55}>
      {/* the model's front (+Z) turns to the door side (−X) */}
      <Shell
        name="workshop"
        turn={-Math.PI / 2}
        nodes={nodes}
        grey={
          <>
            <mesh position={[0, 0.9, 0]} material={MAT.panel} castShadow receiveShadow>
              <boxGeometry args={[2.2, 1.8, 2.2]} />
            </mesh>
            <mesh position={[0, 1.86, 0]} material={MAT.gold}>
              <boxGeometry args={[2.3, 0.12, 2.3]} />
            </mesh>
            <mesh position={[-1.105, 0.75, 0]} rotation-y={-Math.PI / 2} material={MAT.glass}>
              <planeGeometry args={[1.1, 1.4]} />
            </mesh>
          </>
        }
      />
      <mesh position={[-0.6, 2.02, 0.6]} material={on ? GLOW.cableOn : GLOW.dark}>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
      </mesh>
        </group>
      )}
    </group>
  );
}
