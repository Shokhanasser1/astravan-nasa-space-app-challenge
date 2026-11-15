import * as THREE from 'three';
import { HDU, HDU_COMPLEX, HDU_MODULE_X, type HduModule } from './layout';

/**
 * The numbers HduComplex.tsx draws by, measured on public/models/nasa-outpost/hdu_complex.glb (15 Nov): no React here,
 * so the tests check them against the model itself (src/scene/hduModels.test.ts). Every module is the same model,
 * in its MODULE frame: its centre, the door at +z, azimuth a = atan2(x, z) (0 = the door).
 */

/** The shell's outer face: r 1.99 on the ground floor, 2.03 on the loft (HDU.shell 2.1 is the deck ring and hatch rims). */
export const SHELL_R = { ground: 1.995, loft: 2.035 } as const;

/** Eight radial fins on every module, r 1.9–3.4 m, from 0.8 m up to the dome, at 22.5° + k·45° (the door between two). */
export const FIN_AZ: readonly number[] = Array.from({ length: 8 }, (_, k) => THREE.MathUtils.degToRad(22.5 + 45 * k));

/** The pressurised tunnels' outer skin (panel r 1.13 round their axis, HDU.tunnelY up), along the module's ±x. */
export const TUNNEL_SKIN = 1.13;

/**
 * Round portholes that glow while the module has batteries (like ASTRA's windows; GLOW.window / GLOW.dark): on the
 * shell between the fins, clear of the door (+z), the tunnels (±x) and the side module at the back. Two on the ground
 * floor (45° either side of the door, over the sandbag bays), two on the loft (35°: at 45° the work porch's post, at
 * r 3.5 and 2.2–4.7 m up, stands in front of the left one) and one on the loft over the door.
 * [azimuth, height, radius]: 3 cm proud of the shell.
 */
export const PORT_R = 0.22;
const deg = THREE.MathUtils.degToRad;
export const PORTS: readonly (readonly [number, number, number])[] = [
  [deg(45), 1.75, SHELL_R.ground + 0.03],
  [deg(-45), 1.75, SHELL_R.ground + 0.03],
  [deg(35), 3.8, SHELL_R.loft + 0.03],
  [deg(-35), 3.8, SHELL_R.loft + 0.03],
  [0, 3.8, SHELL_R.loft + 0.03],
];

/** Which module a point (game x, z) belongs to: the nearest along the complex (taps on a tunnel go to its nearer end). */
export function moduleAt(x: number, z: number): HduModule {
  const c = Math.cos(HDU_COMPLEX.turn), s = Math.sin(HDU_COMPLEX.turn);
  const lx = (x - HDU_COMPLEX.x) * c - (z - HDU_COMPLEX.z) * s;
  if (lx < (HDU_MODULE_X.greenhouse + HDU_MODULE_X.habitat) / 2) return 'greenhouse';
  if (lx > (HDU_MODULE_X.habitat + HDU_MODULE_X.lab) / 2) return 'lab';
  return 'habitat';
}

/**
 * The habitat module's sandbag shield (src/scene/parts/Sandbags.tsx, `view.wall`): two rows leaning on the shell, laid
 * only where a bag fits whole. Every bag stays inside the module's walk hitbox (HITBOX: a disc r 3.3 round (0, −0.3),
 * src/walk/world.ts adds its 0.1 margin), so no one walks through them, and clear of the door, the tunnels, the work
 * porch (front left), the side module and frame at the back, and the fins. That leaves the two bays between the fins
 * either side of the door: the shield faces the hub, where the player sees it grow.
 */
export const SHIELD = { radius: SHELL_R.ground, rows: 2 } as const;
export const HITBOX = { x: 0, z: -0.3, r: 3.3 } as const;
export const PORCH = { x0: -3.6, x1: -1.5, z0: 2.5, z1: 3.5 } as const;
const BACK_Z = -1;
const FIN_GAP = 0.06; // a fin's half thickness and a hair of air (m)
const TILT_PAD = 0.03; // the bags' small random turn (±0.06 rad) and a hair of air (m)

/** The four corners (x, z) of a bag `w` wide (along the ring) and `d` deep at azimuth `a`, ring radius `r`. */
export function bagCorners(a: number, r: number, w: number, d: number): [number, number][] {
  const ux = Math.sin(a), uz = Math.cos(a); // outwards
  const tx = Math.cos(a), tz = -Math.sin(a); // along the ring
  const out: [number, number][] = [];
  for (const sd of [-1, 1]) for (const sw of [-1, 1]) out.push([ux * (r + (sd * d) / 2) + (tx * sw * w) / 2, uz * (r + (sd * d) / 2) + (tz * sw * w) / 2]);
  return out;
}

const wrap = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
/** The bay between two fins a point is in (0 = between the fins at 22.5° and 67.5°). */
const bayOf = (x: number, z: number) => Math.floor(wrap(Math.atan2(x, z) - FIN_AZ[0]) / (Math.PI / 4));
/** Distance (m) from a point to the nearest fin's plane (fins are radial). */
function finDistance(x: number, z: number): number {
  const r = Math.hypot(x, z), a = Math.atan2(x, z);
  let best = Infinity;
  for (const f of FIN_AZ) best = Math.min(best, r * Math.abs(Math.sin(Math.atan2(Math.sin(a - f), Math.cos(a - f)))));
  return best;
}

/** Does a bag `w` × `d` at (a, r) cover the point (x, z)? */
function underBag(a: number, r: number, w: number, d: number, x: number, z: number): boolean {
  const dx = x - Math.sin(a) * r, dz = z - Math.cos(a) * r;
  return Math.abs(dx * Math.cos(a) - dz * Math.sin(a)) <= w / 2 && Math.abs(dx * Math.sin(a) + dz * Math.cos(a)) <= d / 2;
}
const PORCH_CORNERS = [[PORCH.x0, PORCH.z0], [PORCH.x0, PORCH.z1], [PORCH.x1, PORCH.z0], [PORCH.x1, PORCH.z1]] as const;

/** Is a bag `w` × `d` at (a, r) clear of everything round the habitat module? (Sandbags `keep`) */
export function shieldKeep(w: number, d: number): (a: number, r: number) => boolean {
  return (a, r) => {
    const bay = bayOf(Math.sin(a) * r, Math.cos(a) * r);
    if (PORCH_CORNERS.some(([x, z]) => underBag(a, r, w + 2 * TILT_PAD, d + 2 * TILT_PAD, x, z))) return false;
    return bagCorners(a, r, w + 2 * TILT_PAD, d + 2 * TILT_PAD).every(
      ([x, z]) =>
        Math.hypot(x - HITBOX.x, z - HITBOX.z) <= HITBOX.r &&
        z >= BACK_Z &&
        !(x > PORCH.x0 && x < PORCH.x1 && z > PORCH.z0 && z < PORCH.z1) &&
        !(Math.abs(x) > SHELL_R.ground - 0.2 && Math.abs(z) < TUNNEL_SKIN) &&
        !(Math.abs(x) < HDU.door.w / 2 + 0.2 && z > 0) &&
        bayOf(x, z) === bay &&
        finDistance(x, z) >= FIN_GAP,
    );
  };
}

/**
 * The exterior GLB as one instanced mesh per part and paint: its three modules share one shell and one frame model and
 * its two tunnels one tunnel model, so 14 meshes draw in 6 calls (shells, frames, and the tunnels' four paints).
 * Only the shells cast shadows. NASA's paints come as "glass" (KHR_materials_transmission 1, metallic 1: an extra
 * transmission render pass on every frame in three.js); they become plain matte paint on the same texture.
 * Returns the group in the complex frame and what to dispose (the materials made here; the geometries and textures
 * belong to the loader's cache).
 */
export function buildExterior(scene: THREE.Object3D): { group: THREE.Group; dispose: () => void } {
  scene.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  const sets = new Map<string, { mesh: THREE.Mesh; at: THREE.Matrix4[]; part: string }>();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    let top: THREE.Object3D = o;
    while (top.parent && top.parent !== scene) top = top.parent;
    const part = top.name.endsWith('_shell') ? 'shell' : top.name.endsWith('_frame') ? 'frame' : 'tunnel';
    const key = `${m.geometry.uuid}:${m.material.uuid}`;
    let s = sets.get(key);
    if (!s) sets.set(key, (s = { mesh: m, at: [], part }));
    s.at.push(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld));
  });
  const made = new Map<THREE.Material, THREE.Material>();
  const group = new THREE.Group();
  group.name = 'hdu_complex';
  for (const s of sets.values()) {
    const im = new THREE.InstancedMesh(s.mesh.geometry, matte(s.mesh.material as THREE.Material, made), s.at.length);
    s.at.forEach((m4, i) => im.setMatrixAt(i, m4));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.name = `hdu_${s.part}_${(s.mesh.material as THREE.Material).name}`;
    im.castShadow = s.part === 'shell';
    im.receiveShadow = true;
    group.add(im);
  }
  return {
    group,
    dispose: () => {
      for (const m of made.values()) m.dispose();
      for (const c of group.children) (c as THREE.InstancedMesh).dispose();
    },
  };
}

function matte(m: THREE.Material, made: Map<THREE.Material, THREE.Material>): THREE.Material {
  const p = m as THREE.MeshPhysicalMaterial;
  if (!p.isMeshPhysicalMaterial || !(p.transmission > 0)) return m;
  let out = made.get(m);
  if (!out) {
    out = new THREE.MeshStandardMaterial({ name: p.name, map: p.map, color: p.color, side: p.side, roughness: 0.75, metalness: 0 });
    made.set(m, out);
  }
  return out;
}
