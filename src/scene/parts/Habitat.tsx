import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { DOOR_AZ, HDU_HABITAT, LAYOUT, RADIUS } from '../layout';
import { camState } from '../anim';
import { GLOW, MAT } from './materials';
import type { TapHandler } from './tap';
import { Shell } from '../models/Shell';
import { Sandbags } from './Sandbags';
import { AstraHabitat, astraLook } from '../AstraBase';
import { HduHabitat } from '../HduHabitat';

const R = 1.7; // interior room radius (and the ?lite shell's own size, drawn grown to RADIUS.habitat)
const LITE = RADIUS.habitat / R; // ?lite: the old shapes grow with the base (15 Nov: buildings at real size)
const GAP = THREE.MathUtils.degToRad(70); // open side of the interior: the window towards the hub
const WINDOW_AZ = [DOOR_AZ - Math.PI / 2, DOOR_AZ + Math.PI / 2];

/** Habitat → Life Support. Windows glow when it has batteries; wall rings rise around it (one per level). */
export function Habitat({ on, wall, tap }: { on: boolean; wall: number; tap: TapHandler }) {
  const [x, z] = LAYOUT.habitat;
  return (
    <group position={[x, 0, z]}>
      <group onClick={tap}>
        {astraLook && HDU_HABITAT ? (
          <HduHabitat on={on} wall={wall} turn={DOOR_AZ} />
        ) : astraLook ? (
          <AstraHabitat on={on} wall={wall} turn={DOOR_AZ} />
        ) : (
          <group scale={LITE}>
        <Shell
          name="hab"
          turn={DOOR_AZ}
          grey={
            <>
              <mesh position={[0, 1.4, 0]} material={MAT.panel} castShadow receiveShadow>
                <cylinderGeometry args={[R, R, 2.4, 32, 1, true]} />
              </mesh>
              <mesh position={[0, 2.6, 0]} scale={[1, 0.6, 1]} material={MAT.panel} castShadow>
                <sphereGeometry args={[R, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
              <mesh position={[0, 0.1, 0]} material={MAT.gold}>
                <cylinderGeometry args={[R + 0.05, R + 0.05, 0.2, 32]} />
              </mesh>
              <mesh position={[Math.sin(DOOR_AZ) * (R + 0.01), 1.1, Math.cos(DOOR_AZ) * (R + 0.01)]} rotation-y={DOOR_AZ} material={MAT.glass}>
                <planeGeometry args={[0.9, 1.8]} />
              </mesh>
            </>
          }
        />
        <Instances limit={2} material={on ? GLOW.window : GLOW.dark} frustumCulled={false}>
          <planeGeometry args={[0.55, 0.38]} />
          {WINDOW_AZ.map((a) => (
            <Instance key={a} position={[Math.sin(a) * (R + 0.01), 1.9, Math.cos(a) * (R + 0.01)]} rotation={[0, a, 0]} />
          ))}
        </Instances>
          </group>
        )}
      </group>
      {/* (the ASTRA look brings the furnished interior: src/scene/Interiors.tsx) */}
      {!astraLook && <Interior />}
      {/* ASTRA's habitat brings its own regolith shield (AstraHabitat); our sandbag rings stay for ?lite */}
      {!astraLook && <Sandbags wall={wall} radius={RADIUS.habitat} />}
    </group>
  );
}

/** Seen only from the inside point: unlit walls with the open side towards the hub, floor, ceiling, one lamp. */
function Interior() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = camState.inside;
  });
  const thetaStart = DOOR_AZ + GAP / 2;
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[R - 0.08, R - 0.08, 2.4, 32, 1, true, thetaStart, Math.PI * 2 - GAP]} />
        <meshBasicMaterial color="#262b3a" side={THREE.BackSide} />
      </mesh>
      {/* sill and lintel: the gap becomes a window from 1.0 m to 2.2 m */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[R - 0.08, R - 0.08, 0.8, 12, 1, true, thetaStart - GAP, GAP]} />
        <meshBasicMaterial color="#2e3444" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[R - 0.08, R - 0.08, 0.4, 12, 1, true, thetaStart - GAP, GAP]} />
        <meshBasicMaterial color="#2e3444" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 2.55, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[R - 0.08, 32]} />
        <meshBasicMaterial color="#1b1f2b" />
      </mesh>
      <mesh position={[0, 0.21, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[R - 0.08, 32]} />
        <meshBasicMaterial color="#30343f" />
      </mesh>
      <mesh position={[Math.sin(DOOR_AZ + Math.PI) * 1.1, 0.5, Math.cos(DOOR_AZ + Math.PI) * 1.1]} rotation-y={DOOR_AZ}>
        <boxGeometry args={[1.5, 0.5, 0.7]} />
        <meshBasicMaterial color="#3b4152" />
      </mesh>
      <mesh position={[0, 2.45, 0]} material={GLOW.window}>
        <boxGeometry args={[0.9, 0.04, 0.12]} />
      </mesh>
    </group>
  );
}

