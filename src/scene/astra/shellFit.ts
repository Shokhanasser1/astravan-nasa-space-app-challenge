import * as THREE from 'three';
import { HDU, HDU_HABITAT } from '../layout';

/**
 * Where ASTRA's shells meet our furnished interiors (src/scene/Interiors.tsx; blender/interiors/<b>/HANDOFF.md).
 * Every number is in the building's model frame, native metres (before ASTRA_SCALE and its turn): the interior GLB
 * and its shell share one transform, so they match at any scale.
 *
 * ASTRA's doors are decorative, drawn on a solid shell: our interiors put a real door in the same spot, and the
 * shell under it must go, or the open door shows ASTRA's wall (habitat), grey disc (lab) or grey panel (lander)
 * instead of the room. The cuts below are the ones each HANDOFF.md asks for (checked there in Blender).
 */

const pa = new THREE.Vector3();
const pb = new THREE.Vector3();
const pc = new THREE.Vector3();
const hexOf = (m: THREE.Material) => (m as THREE.MeshStandardMaterial).color?.getHexString() ?? '';

/**
 * Drop every triangle of `g`'s meshes that `cut(a, b, c, colour)` says (model frame: call it while `g` has no
 * transform of its own, before bake). A mesh left with nothing is hidden. Instanced meshes and multi-material
 * meshes are left alone. Returns how many triangles went.
 */
export function cutShell(
  g: THREE.Object3D,
  cut: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, colour: string) => boolean,
): number {
  g.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const m4 = new THREE.Matrix4();
  let removed = 0;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh || !m.visible || Array.isArray(m.material)) return;
    const colour = hexOf(m.material);
    const src = m.geometry;
    const pos = src.getAttribute('position');
    if (!pos) return;
    const idx = src.index;
    const n = idx ? idx.count : pos.count;
    m4.multiplyMatrices(toRoot, m.matrixWorld);
    const keep: number[] = [];
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t;
      const i1 = idx ? idx.getX(t + 1) : t + 1;
      const i2 = idx ? idx.getX(t + 2) : t + 2;
      pa.fromBufferAttribute(pos, i0).applyMatrix4(m4);
      pb.fromBufferAttribute(pos, i1).applyMatrix4(m4);
      pc.fromBufferAttribute(pos, i2).applyMatrix4(m4);
      if (!cut(pa, pb, pc, colour)) keep.push(i0, i1, i2);
    }
    const gone = Math.floor(n / 3) - keep.length / 3;
    if (gone <= 0) return;
    removed += gone;
    if (!keep.length) {
      m.visible = false; // (bake skips hidden meshes)
      return;
    }
    const cutGeo = src.clone(); // (ASTRA's geometries are cached and shared: never edit one in place)
    cutGeo.setIndex(keep);
    cutGeo.clearGroups();
    cutGeo.userData = {};
    m.geometry = cutGeo;
  });
  return removed;
}

const hbox = new THREE.Box3();

/**
 * Hide ASTRA's own inside parts where our interior GLB (Interiors.tsx) takes their place: every mesh (model frame,
 * native metres, before bake) for which `drop(its bounding box, its colour)` is true. Hidden meshes are not baked.
 */
export function hideParts(g: THREE.Object3D, drop: (b: THREE.Box3, colour: string, m: THREE.Mesh) => boolean): void {
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    hbox.setFromObject(m);
    if (!hbox.isEmpty() && drop(hbox, Array.isArray(m.material) ? '' : hexOf(m.material), m)) m.visible = false;
  });
}

/**
 * Habitat: whatever of ASTRA lies inside our lining (its decks and core in ASTRA's own build; today only the
 * collar's "HAB-1" label plate, 0.1 m inside the lining on the upper deck), and the shell in front of our airlock's
 * outer hatch, so the open hatch shows the airlock. The shell, windows and shield stay.
 */
export function habitatInside(g: THREE.Object3D): void {
  hideParts(g, (b) => {
    const r = Math.max(Math.hypot(b.min.x, b.min.z), Math.hypot(b.max.x, b.min.z), Math.hypot(b.min.x, b.max.z), Math.hypot(b.max.x, b.max.z));
    return r < 4.85 && b.min.y > 0.3 && b.max.y < 6.2;
  });
  cutHabitatDoor(g);
}

const inBox = (p: THREE.Vector3, b: readonly [number, number, number, number, number, number]) =>
  p.x >= b[0] && p.x <= b[1] && p.y >= b[2] && p.y <= b[3] && p.z >= b[4] && p.z <= b[5];
const mid = new THREE.Vector3();

/**
 * Habitat (interiors/habitat/HANDOFF.md): the quilted shell (#e7e9ec) and its restraint bands (#c9ced6) in front of
 * our airlock's outer hatch, box x ±0.64, y 0.78–2.56, z 4.80–5.45. A triangle goes when its middle is in the box
 * (as the Blender path check did): the phone build has the shell's coarse columns (0.34 m apart), and an
 * all-corners rule would leave a hole narrower than the 1.016 m hatch. Our collar plate (±0.82 m) covers the edge.
 */
export const HAB_DOOR_BOX = [-0.64, 0.64, 0.78, 2.56, 4.8, 5.45] as const;
export function cutHabitatDoor(g: THREE.Object3D): number {
  return cutShell(g, (a, b, c, colour) => {
    if (colour !== 'e7e9ec' && colour !== 'c9ced6') return false;
    mid.copy(a).add(b).add(c).divideScalar(3);
    return inBox(mid, HAB_DOOR_BOX);
  });
}

/**
 * Lab (interiors/lab/HANDOFF.md): ASTRA's round hatch on the west dome and the dome cap behind it, every triangle
 * with all three corners in x −2.05…−1.84, within 0.47 m of the hatch axis (y 1.363, z 0).
 */
const inLabHatch = (p: THREE.Vector3) => p.x >= -2.05 && p.x <= -1.84 && Math.hypot(p.y - 1.363, p.z) <= 0.47;
export function cutLabHatch(g: THREE.Object3D): number {
  return cutShell(g, (a, b, c) => inLabHatch(a) && inLabHatch(b) && inLabHatch(c));
}

/**
 * Lander (interiors/lander/HANDOFF.md): ASTRA's hatch panel, hatch ring and the cabin facet behind them, every
 * triangle with all three corners in x ±0.43, y 2.945–4.21, z 1.27–1.45.
 */
export const LANDER_HATCH_BOX = [-0.43, 0.43, 2.945, 4.21, 1.27, 1.45] as const;
export function cutLanderHatch(g: THREE.Object3D): number {
  return cutShell(g, (a, b, c) => inBox(a, LANDER_HATCH_BOX) && inBox(b, LANDER_HATCH_BOX) && inBox(c, LANDER_HATCH_BOX));
}

/**
 * Lander: ASTRA builds its crew cabin as a 10-sided lathe, but at the phone detail (kit.ts `sg`, LOD 0.5) it comes out
 * 6-sided, and our cabin (a 10-sided lining, 2.34 m across the flats) then pokes out through its flats (94 vertices,
 * up to 5.4 cm native) while ASTRA's hatch panel no longer sits on a flat. The cabin keeps its 10 sides at any detail
 * (+48 triangles). Call before finalize.
 */
const CABIN: [number, number][] = [[0, 2.78], [1.25, 2.78], [1.35, 3.0], [1.35, 4.2], [1.15, 4.65], [0.75, 4.85], [0, 4.9]];
const cabinBox = new THREE.Box3();
export function tenSidedCabin(l: THREE.Object3D): boolean {
  let done = false;
  l.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || hexOf(m.material) !== 'e8ecf2') return;
    // ASTRA's "lm-cabin" lathe (site.ts buildLander), already merged on its own: 7 profile points × (sides + 1)
    const n = m.geometry.getAttribute('position')?.count ?? 0;
    const sides = n / CABIN.length - 1;
    if (!Number.isInteger(sides) || sides >= 10) return;
    m.geometry.computeBoundingBox();
    cabinBox.copy(m.geometry.boundingBox!);
    if (Math.abs(cabinBox.min.y - 2.78) > 0.01 || Math.abs(cabinBox.max.y - 4.9) > 0.01 || cabinBox.max.x > 1.36) return;
    m.geometry = new THREE.LatheGeometry(CABIN.map(([r, y]) => new THREE.Vector2(r, y)), 10).rotateY(Math.PI / 10);
    done = true;
  });
  return done;
}

/**
 * The habitat's furnished room, in its model frame: inside the lining (r 4.92 m), up to the upper deck's ceiling
 * (5.95 m). Interiors.tsx draws the whole room while the camera is in here (first person walks the whole room now:
 * at ASTRA_SCALE.habitat 0.6 it is 2.95 m across in the game, no longer the 1.6 m of the old 0.34 scale).
 */
export const HAB_LINING = 4.92;
export const HAB_CEILING = 5.95;
/** Is a camera at (dx, dy, dz) from the habitat's foot (game metres) inside its room, at scale k? */
export function inHabitatRoom(dx: number, dy: number, dz: number, k: number): boolean {
  // (the HDU habitat, `?hdu`: its lining 2.925 m and dome top 8.62 m, game metres at k 1)
  if (HDU_HABITAT) return Math.hypot(dx, dz) < HDU.lining * k && dy < HDU.top * k;
  return Math.hypot(dx, dz) < HAB_LINING * k && dy < HAB_CEILING * k;
}
