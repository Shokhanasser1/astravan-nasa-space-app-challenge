import { useMemo } from 'react';
import * as THREE from 'three';
import { groundHeight } from './ground';

/** 520 m ground, 128 × 128 cells, heights by formula (ground.ts). Receives shadows, never casts them. */
export function Terrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(520, 520, 128, 128);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const soil = new THREE.Color('#a3a5ad');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = groundHeight(x, z);
      pos.setY(i, h);
      // Slight colour variation: darker crater floors, faint mottling (soil roughness 1, no texture before G2).
      const k = 1 + 0.05 * Math.sin(x * 0.37) * Math.cos(z * 0.29) + Math.min(0, h) * 0.04;
      colors[i * 3] = soil.r * k;
      colors[i * 3 + 1] = soil.g * k;
      colors[i * 3 + 2] = soil.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
