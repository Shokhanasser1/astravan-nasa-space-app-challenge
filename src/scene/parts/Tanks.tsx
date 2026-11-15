import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Resources } from '../../state/game';
import { HDU, HDU_HABITAT, HDU_MODULE_X, LAYOUT, RADIUS, TANKS, complexToGame } from '../layout';
import { TUNNEL_SKIN } from '../hduParts';
import { bake } from '../astra/bake';
import { ball, box, cyl, finalize, metal, paint, pipe, torus } from '../../vendor/astra/scene/kit';
import { C, skid } from '../../vendor/astra/scene/models/common';

/**
 * Life support's air and water tanks (15 Nov): three upright tanks on a skid by the habitat, a pipe to its wall,
 * and a glowing level band on each = the engine's air-and-water reserve (View.res.air / res.airMax; a game rule,
 * days). Cool blue while there is enough, amber at ≤ 2 days, red at ≤ 1 day. No animation, no blinking.
 * Cost: the tanks are baked in ASTRA's paints and join the base's merged mesh (AstraMerge, name `astra_`), the three
 * bands are one instanced mesh: +1 draw call. Positions: src/scene/layout.ts TANKS.
 */
const XS = [-0.78, 0, 0.78];
const TANK_R = 0.32;
const BAND_Y = 0.45; // bottom of the band, above the skid
const BAND_H = 1.45; // full band height
const FACE = TANK_R + 0.035; // the band sits on the tank's face towards the hub (local +z)

const tmp = new THREE.Object3D();

function buildTanks(): THREE.Group {
  const g = new THREE.Group();
  const deck = skid(g, 2.5, 0.95, 0.24);
  const white = paint(C.white, 0.42, 0.12);
  const steel = metal('#9aa3b4', 0.36);
  const dark = paint(C.dark, 0.55, 0.3);
  const blue = paint('#3b78d8', 0.5, 0.2);
  for (const [i, x] of XS.entries()) {
    const top = deck + 1.75;
    cyl(g, TANK_R, TANK_R, 1.6, white, x, deck + 0.15 + 0.8, 0, 24);
    ball(g, TANK_R, white, x, deck + 0.95 + 0.8, 0, 20);
    torus(g, TANK_R + 0.012, 0.025, steel, x, deck + 0.3, 0).rotation.x = Math.PI / 2;
    torus(g, TANK_R + 0.012, 0.025, i === 1 ? blue : steel, x, deck + 1.55, 0).rotation.x = Math.PI / 2;
    cyl(g, 0.05, 0.05, 0.14, steel, x, top + 0.28, 0, 10); // valve
    // the empty part of the gauge: a dark slot the band fills
    box(g, 0.13, BAND_H + 0.06, 0.02, dark, x, BAND_Y + BAND_H / 2, FACE - 0.012);
  }
  // manifold along the tops, then down and along the ground to the habitat's wall
  pipe(g, [[XS[0], deck + 2.1, 0], [XS[2], deck + 2.1, 0]], 0.035, steel, 6);
  pipe(g, [[XS[2], deck + 2.1, 0], [XS[2] + 0.35, deck + 2.1, 0], [XS[2] + 0.35, 0.1, 0], ...pipeEnd()], 0.04, steel, 6);
  finalize(g);
  bake(g, { keep: [], live: [] });
  g.name = 'astra_tanks'; // AstraMerge folds its paints into the base's merged mesh
  return g;
}

/** An offset (game metres from the tanks) in the tanks' own frame. */
function turnToTanks(wx: number, wz: number): [number, number] {
  const c = Math.cos(TANKS.yaw);
  const s = Math.sin(TANKS.yaw);
  return [wx * c - wz * s, wx * s + wz * c];
}
const inTankFrame = (x: number, z: number) => turnToTanks(x - TANKS.x, z - TANKS.z);

/**
 * Where the pipe goes after it comes down from the manifold, in the tanks' frame. ASTRA: along the ground to the
 * habitat's shell at the point nearest the tanks, up into it. HDU (`?hdu`): the tanks stand between the habitat and
 * lab modules, and the habitat's shell faces them only behind its fins and sandbag bay, so the pipe runs to the
 * pressurised tunnel to the lab instead (its front skin, between two of its gold rings) and into it at the axis.
 */
function pipeEnd(): [number, number, number][] {
  if (HDU_HABITAT) {
    const lx = HDU_MODULE_X.habitat + 4.8;
    const at = inTankFrame(...complexToGame(lx, TUNNEL_SKIN + 0.06));
    const into = inTankFrame(...complexToGame(lx, TUNNEL_SKIN - 0.05));
    return [
      [at[0], 0.1, at[1]],
      [at[0], HDU.tunnelY, at[1]],
      [into[0], HDU.tunnelY, into[1]],
    ];
  }
  const dx = LAYOUT.habitat[0] - TANKS.x;
  const dz = LAYOUT.habitat[1] - TANKS.z;
  const d = Math.hypot(dx, dz);
  const k = (d - (RADIUS.habitat + 0.15)) / d;
  const toHab = turnToTanks(dx * k, dz * k);
  return [
    [toHab[0], 0.1, toHab[1]],
    [toHab[0], 0.6, toHab[1]],
  ];
}

const OK = new THREE.Color('#5fd0ff').multiplyScalar(1.6);
const LOW = new THREE.Color('#ffb340').multiplyScalar(1.8);
const BAD = new THREE.Color('#ff4d5e').multiplyScalar(1.8);

export function Tanks({ res }: { res?: Resources }) {
  const body = useMemo(buildTanks, []);
  const band = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.09, 1, 0.02).translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: OK, toneMapped: false });
    const m = new THREE.InstancedMesh(geo, mat, XS.length);
    m.frustumCulled = false;
    return m;
  }, []);
  useEffect(
    () => () => {
      band.geometry.dispose();
      (band.material as THREE.Material).dispose();
    },
    [band],
  );
  const invalidate = useThree((s) => s.invalidate);
  // Before the first plan (no res yet) the tanks read full.
  const days = res ? res.air : 1;
  const share = res && res.airMax > 0 ? Math.max(0, Math.min(1, res.air / res.airMax)) : 1;
  const low = res ? days <= 2 : false;
  const bad = res ? days <= 1 : false;
  useEffect(() => {
    for (const [i, x] of XS.entries()) {
      tmp.position.set(x, BAND_Y, FACE);
      tmp.scale.set(1, Math.max(0.02, BAND_H * share), 1);
      tmp.updateMatrix();
      band.setMatrixAt(i, tmp.matrix);
    }
    band.instanceMatrix.needsUpdate = true;
    (band.material as THREE.MeshBasicMaterial).color.copy(bad ? BAD : low ? LOW : OK);
    invalidate();
  }, [band, share, low, bad, invalidate]);
  return (
    <group position={[TANKS.x, 0, TANKS.z]} rotation-y={TANKS.yaw}>
      <primitive object={body} />
      <primitive object={band} />
    </group>
  );
}
