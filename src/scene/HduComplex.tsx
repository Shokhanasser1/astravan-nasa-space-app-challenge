import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { HDU_COMPLEX, HDU_HABITAT, HDU_MODULE_X, HDU_MODULES, type HduModule } from './layout';
import { GLOW, glowColor } from './parts/materials';
import type { TapHandler } from './parts/tap';
import { Interior } from './Interiors';
import { BAG, Sandbags } from './parts/Sandbags';
import { DOOR_FRAME, DOOR_LAMP, GAUGE, GROW_LIGHT, PORTS, PORT_R, SHIELD, buildExterior, moduleAt, shieldKeep, type GlowPiece } from './hduParts';

/**
 * The base core as NASA's Habitat Demonstration Unit complex (`?hdu`, layout.ts HDU_HABITAT; 15 Nov, Samandar): three
 * HDU modules at real size joined by pressurised tunnels — C greenhouse (the garden), A habitat (Life Support), B lab
 * (the workshop) — in place of ASTRA's habitat, greenhouse and lab. Every module is walk-in.
 * - Exterior: public/models/nasa-outpost/hdu_complex.glb (NASA 3D Resources HDU parts 1 + 2, logos painted out; built
 *   by oy-karvonsaroyi-3d/hb7/hdu_base/build_game_complex.py) in the complex frame, drawn as 6 instanced meshes
 *   (hduParts.ts buildExterior); only the shells cast shadows.
 * - Interiors: public/models/interiors/hdu_<id>.glb at each module's centre (Interiors.tsx: whole while the camera is
 *   in the module, else only the door leaf); the greenhouse's lettuce grows with the garden level.
 * - Portholes glow while their module has batteries (the greenhouse's grow-light magenta); the habitat module's sandbag
 *   shield grows with the wall level. Every door has a lamp bar and a glowing outline (D2: they do not wait for the
 *   Sun); the greenhouse door a 4-cell growth gauge lit by the garden level (D5). All of it waits for the exterior
 *   model inside one Suspense (nothing hangs in the air while it loads or if it fails), and the model is preloaded.
 * - A tap anywhere on the complex is a tap on the module it hit (a tunnel: its nearer end), the same handlers as
 *   ASTRA's buildings had (BaseScene: Life Support, garden, workshop).
 */
const file = `${import.meta.env.BASE_URL}models/nasa-outpost/hdu_complex.glb`;
if (HDU_HABITAT) useGLTF.preload(file, false, true);

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
const GROW = glowColor(GROW_LIGHT, 2.6);

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
      const c = !lit[id] ? GLOW.dark.color : id === 'greenhouse' ? GROW : GLOW.window.color;
      for (let i = 0; i < PORTS.length; i++) mesh.setColorAt(k * PORTS.length + i, c);
    });
    mesh.instanceColor!.needsUpdate = true;
    invalidate();
  }, [mesh, habitat, greenhouse, lab, invalidate]);
  return <primitive object={mesh} />;
}

const LAMP = glowColor('#fff1d0', 3.0);
const FRAME = glowColor('#9fe8ff', 1.8);
const GAUGE_ON = glowColor('#7dff8a', 2.4);
type Lit = { id: HduModule; g: GlowPiece; kind: 'lamp' | 'frame' | 'gauge'; i: number };
const LIGHTS: Lit[] = HDU_MODULES.flatMap((id) => [
  ...DOOR_LAMP.map((g, i): Lit => ({ id, g, kind: 'lamp', i })),
  ...DOOR_FRAME.map((g, i): Lit => ({ id, g, kind: 'frame', i })),
  ...(id === 'greenhouse' ? GAUGE.map((g, i): Lit => ({ id, g, kind: 'gauge', i })) : []),
]);

/**
 * Every door's lamp bar and outline and the greenhouse's growth gauge (D2, D5; positions: hduParts.ts) in one instanced
 * mesh of boxes (one draw call), glowing (`toneMapped={false}`, like the portholes): no real lights.
 */
function DoorLights({ plant }: { plant: number }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), LIGHTS.length);
    LIGHTS.forEach(({ id, g, kind }, n) => {
      portAt.position.set(HDU_MODULE_X[id] + Math.sin(g.a) * g.r, g.y, Math.cos(g.a) * g.r);
      portAt.rotation.set(0, g.a, 0);
      portAt.scale.set(g.w, g.h, g.d);
      portAt.updateMatrix();
      m.setMatrixAt(n, portAt.matrix);
      m.setColorAt(n, kind === 'lamp' ? LAMP : kind === 'frame' ? FRAME : GLOW.dark.color);
    });
    portAt.scale.set(1, 1, 1);
    m.computeBoundingSphere();
    m.name = 'hdu_door_lights';
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
  useEffect(() => {
    LIGHTS.forEach(({ kind, i }, n) => {
      if (kind === 'gauge') mesh.setColorAt(n, i < plant ? GAUGE_ON : GLOW.dark.color);
    });
    mesh.instanceColor!.needsUpdate = true;
    invalidate();
  }, [mesh, plant, invalidate]);
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
      {/* everything on the shells waits for the shells: no portholes, lights or bags hanging in the air */}
      <Quiet>
        <Suspense fallback={null}>
          <Exterior />
          <Ports on={on} />
          <DoorLights plant={p} />
          <group position-x={HDU_MODULE_X.habitat}>
            <Sandbags wall={wall} radius={SHIELD.radius} rows={SHIELD.rows} keep={keepBag} />
          </group>
        </Suspense>
      </Quiet>
      {HDU_MODULES.map((id) => (
        <group key={id} position-x={HDU_MODULE_X[id]}>
          <Interior id={id} plant={id === 'greenhouse' ? p : undefined} />
        </group>
      ))}
    </group>
  );
}
