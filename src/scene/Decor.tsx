import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DOOR_AZ, DOOR_R, LAYOUT, PARKED_ROVER as SEV } from './layout';
import { ICE_CRATER, groundHeight } from './ground';

/**
 * NASA models around the base that are not machines of the week (public/models/nasa-decor, Samandar's catalog,
 * real size in metres, their own NASA textures): the crew rover parked by the base, RASSOR digging at the rim of
 * the ice crater, cargo bags at the habitat door. Each loads on its own; one that fails is simply not shown.
 */
const base = `${import.meta.env.BASE_URL}models/nasa-decor/`;
const toCrater = Math.atan2(ICE_CRATER.x, ICE_CRATER.z);
const RASSOR = { x: ICE_CRATER.x - Math.sin(toCrater) * 27, z: ICE_CRATER.z - Math.cos(toCrater) * 27, yaw: toCrater };
// (just outside the habitat's regolith shield, beside the door)
const doorX = LAYOUT.habitat[0] + Math.sin(DOOR_AZ) * (DOOR_R + 0.7);
const doorZ = LAYOUT.habitat[1] + Math.cos(DOOR_AZ) * (DOOR_R + 0.7);
const BAGS: [number, number, number, number][] = [
  [doorX + Math.cos(DOOR_AZ) * 1.0, 0, doorZ - Math.sin(DOOR_AZ) * 1.0, 0.3],
  [doorX + Math.cos(DOOR_AZ) * 1.5, 0, doorZ - Math.sin(DOOR_AZ) * 1.5, -0.2],
  [doorX + Math.cos(DOOR_AZ) * 1.25, 0.24, doorZ - Math.sin(DOOR_AZ) * 1.25, 1.2],
];

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Model({ file, at, yaw, shadow = true }: { file: string; at: [number, number, number]; yaw: number; shadow?: boolean }) {
  const { scene } = useGLTF(base + file, false, true);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = shadow;
        m.receiveShadow = true;
      }
      if (m.name.startsWith('COL_')) m.visible = false; // the catalog's collider boxes are never drawn
    });
    return o;
  }, [scene, shadow]);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true; // the once-a-day shadow map must include it
    invalidate();
  }, [obj, gl, invalidate]);
  return <primitive object={obj} position={at} rotation-y={yaw} />;
}

function One(props: { file: string; at: [number, number, number]; yaw: number; shadow?: boolean }) {
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Model {...props} />
      </Suspense>
    </Quiet>
  );
}

export function Decor() {
  return (
    <group>
      <One file="sev.glb" at={[SEV.x, groundHeight(SEV.x, SEV.z), SEV.z]} yaw={SEV.yaw} />
      <One file="rassor.glb" at={[RASSOR.x, groundHeight(RASSOR.x, RASSOR.z), RASSOR.z]} yaw={RASSOR.yaw} />
      {BAGS.map(([x, y, z, yaw], i) => (
        <One key={i} file="crew-lock-bag.glb" at={[x, groundHeight(x, z) + y, z]} yaw={yaw} shadow={false} />
      ))}
    </group>
  );
}

