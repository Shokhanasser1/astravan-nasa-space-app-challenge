import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { LAYOUT } from '../layout';
import { MAT } from './materials';
import { Shell, type NodeRef } from '../models/Shell';
import { yaw } from '../models/kit';

/**
 * Dish module: not built, drawn as a faint wire outline (developer guide §06: "sim to'r").
 * With the NASA model (features.nasaModels) the head (dish_head) sweeps slowly, only while the scene clock runs
 * (day, storm, launch): it never asks for frames, so a calm scene stays still and is not redrawn for it.
 */
export function Dish() {
  const [x, z] = LAYOUT.dish;
  const head = useRef<THREE.Object3D | null>(null);
  const nodes = useRef<Record<string, NodeRef>>({ dish_head: head }).current;
  const t = useRef(0);
  useFrame((state, delta) => {
    const h = head.current;
    if (!h || state.frameloop !== 'always') return;
    t.current += Math.min(delta, 0.05);
    yaw(h, 0.5 * Math.sin(0.2 * t.current));
  });
  return (
    <group position={[x, 0, z]}>
      <Shell
        name="dish"
        nodes={nodes}
        grey={
          <>
            <mesh position={[0, 0.8, 0]} material={MAT.wire}>
              <cylinderGeometry args={[0.1, 0.15, 1.6, 6, 1]} />
            </mesh>
            <mesh position={[0, 1.8, 0]} rotation-x={-0.6} material={MAT.wire}>
              <coneGeometry args={[1, 0.5, 16, 1, true]} />
            </mesh>
          </>
        }
      />
    </group>
  );
}
