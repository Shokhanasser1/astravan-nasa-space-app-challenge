import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { HDU_COMPLEX, HDU_MODULE_X, HDU_MODULES, type HduModule } from './layout';
import { GLOW } from './parts/materials';
import type { TapHandler } from './parts/tap';
import { Interior } from './Interiors';
import { BAG, Sandbags } from './parts/Sandbags';
import { PORTS, PORT_R, SHIELD, buildExterior, moduleAt, shieldKeep } from './hduParts';

/**
 * The base core as NASA's Habitat Demonstration Unit complex (`?hdu`, layout.ts HDU_HABITAT; 15 Nov, Samandar): three
 * HDU modules at real size joined by pressurised tunnels — C greenhouse (the garden), A habitat (Life Support), B lab
 * (the workshop) — in place of ASTRA's habitat, greenhouse and lab. Every module is walk-in.
 * - Exterior: public/models/nasa-outpost/hdu_complex.glb (NASA 3D Resources HDU parts 1 + 2, logos painted out; built
 *   by oy-karvonsaroyi-3d/hb7/hdu_base/build_game_complex.py) in the complex frame, drawn as 6 instanced meshes
 *   (hduParts.ts buildExterior); only the shells cast shadows.
 * - Interiors: public/models/interiors/hdu_<id>.glb at each module's centre (Interiors.tsx: whole while the camera is
 *   in the module, else only the door leaf); the greenhouse's lettuce grows with the garden level.
 * - Portholes glow while their module has batteries; the habitat module's sandbag shield grows with the wall level.
 * - A tap anywhere on the complex is a tap on the module it hit (a tunnel: its nearer end), the same handlers as
 *   ASTRA's buildings had (BaseScene: Life Support, garden, workshop).
 */
const file = `${import.meta.env.BASE_URL}models/nasa-outpost/hdu_complex.glb`;

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Exterior() {
  const { scene } = useGLTF(file, false, true);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const ext = useMemo(() => buildExterior(scene), [scene]);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true; // the once-a-day shadow map must include the shells
    invalidate();
    return ext.dispose;
  }, [ext, gl, invalidate]);
  return <primitive object={ext.group} />;
}

const portAt = new THREE.Object3D();

/** Every module's portholes in one instanced mesh (one draw call); each module's lit or dark by its own power. */
function Ports({ on }: { on: Record<HduModule, boolean> }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.CircleGeometry(PORT_R, 20),
      new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      HDU_MODULES.length * PORTS.length,
    );
    HDU_MODULES.forEach((id, k) =>
      PORTS.forEach(([a, y, r], i) => {
        portAt.position.set(HDU_MODULE_X[id] + Math.sin(a) * r, y, Math.cos(a) * r);
        portAt.rotation.set(0, a, 0);
        portAt.updateMatrix();
        m.setMatrixAt(k * PORTS.length + i, portAt.matrix);
        m.setColorAt(k * PORTS.length + i, GLOW.dark.color); // (makes the colour attribute before the first draw)
      }),
    );
    m.computeBoundingSphere();
    m.name = 'hdu_ports';
    return m;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  const invalidate = useThree((s) => s.invalidate);
  const { habitat, greenhouse, lab } = on;
  useEffect(() => {
    const lit = { habitat, greenhouse, lab };
    HDU_MODULES.forEach((id, k) => {
      for (let i = 0; i < PORTS.length; i++) mesh.setColorAt(k * PORTS.length + i, lit[id] ? GLOW.window.color : GLOW.dark.color);
    });
    mesh.instanceColor!.needsUpdate = true;
    invalidate();
  }, [mesh, habitat, greenhouse, lab, invalidate]);
  return <primitive object={mesh} />;
}

const keepBag = shieldKeep(BAG.w, BAG.d);

/**
 * `on`: each module powered (habitat: Life Support, greenhouse: garden, lab: workshop); `wall` 0–3 the habitat's sandbag
 * shield; `plant` 0–4 the greenhouse's lettuce; `taps` each module's tap (= E at it).
 */
export function HduComplex({ on, wall, plant, taps }: { on: Record<HduModule, boolean>; wall: number; plant: number; taps: Record<HduModule, TapHandler> }) {
  const tap = useMemo<TapHandler>(() => (e) => taps[moduleAt(e.point.x, e.point.z)](e), [taps]);
  const p = Math.max(0, Math.min(4, Math.round(plant)));
  return (
    <group position={[HDU_COMPLEX.x, 0, HDU_COMPLEX.z]} rotation-y={HDU_COMPLEX.turn} onClick={tap}>
      <Quiet>
        <Suspense fallback={null}>
          <Exterior />
        </Suspense>
      </Quiet>
      <Ports on={on} />
      {HDU_MODULES.map((id) => (
        <group key={id} position-x={HDU_MODULE_X[id]}>
          <Interior id={id} plant={id === 'greenhouse' ? p : undefined} />
          {id === 'habitat' && <Sandbags wall={wall} radius={SHIELD.radius} rows={SHIELD.rows} keep={keepBag} />}
        </group>
      ))}
    </group>
  );
}
