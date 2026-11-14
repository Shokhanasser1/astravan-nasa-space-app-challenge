/**
 * NASA-based buildings (public/models/nasa-base/, docs/specs/2026-11-14-nasa-models.md). Pure three.js, no React:
 * which files make the kit, which named nodes each must have, how the palette material names in the GLB map onto the
 * shared materials (one material set for grey shapes and models: fewer programs and draw calls, glow stays
 * `toneMapped: false`), which meshes cast shadows, and the small motion helpers the parts call from useFrame.
 */
import * as THREE from 'three';
import { fit } from '../fit';
import { GLOW, MAT } from '../parts/materials';

/** The six buildings: all six are models, or all six stay grey shapes (decided at G3). */
export const BUILDINGS = ['hab', 'garden', 'workshop', 'lander', 'scout', 'dish'] as const;
export type Building = (typeof BUILDINGS)[number];

export const modelPath = (b: Building) => `models/nasa-base/${b}.glb`;

/** Named moving parts each model keeps as pivot nodes (docs/TASKS.md §4.3). A kit without them is not used. */
export const REQUIRED_NODES: Record<Building, readonly string[]> = {
  hab: [],
  garden: [],
  workshop: ['arm'],
  lander: ['lander_body', 'lander_base'],
  scout: ['scout_body', 'scout_wheel_fl', 'scout_wheel_fr', 'scout_wheel_rl', 'scout_wheel_rr'],
  dish: ['dish_head'],
};

/**
 * Real height in metres of each model, base on the ground, as built in Blender to the grey shapes' footprint
 * (docs/layout.md). `fit()` scales every model to it, so a re-export in other units still lands at the right size
 * and the code-side parts (glow rings, plants, lamps, eye) sit where they did. scripts/models.test.ts keeps this table
 * and the files within 3 % of each other.
 */
export const HEIGHT: Record<Building, number> = {
  hab: 3.6,
  garden: 1.63,
  workshop: 2.57,
  lander: 3.31,
  scout: 1.03,
  dish: 2.3,
};

/**
 * Nodes the scene code moves (Lander.tsx lift-off, Dish.tsx sweep, Workshop.tsx arm). They stay separate; every
 * other mesh of a building is merged per material at load (one draw call per palette material). The Scout wheels are
 * named and pivoted in the file but nothing drives the Scout yet: add them here when a drive animation does.
 */
export const ANIMATED: Record<Building, readonly string[]> = {
  hab: [],
  garden: [],
  workshop: ['arm'],
  lander: ['lander_body'],
  scout: [],
  dish: ['dish_head'],
};

/**
 * Models with a few small inside-out fragments left from the NASA meshes (LM leg struts, SEV window recesses, DSN back
 * truss; B's notes): drawn with the double-sided twins of the palette materials. The habitat, garden and workshop are
 * clean and stay single-sided (from inside the habitat you must see through its shell).
 */
export const BOTH_SIDES: ReadonlySet<Building> = new Set<Building>(['lander', 'scout', 'dish']);

/** Footprint: half the model's width/depth must stay within the layout radius + 0.1 m (hitboxes, cable ends). */
export const FOOTPRINT: Partial<Record<Building, number>> = { hab: 1.7, garden: 1.3, workshop: 1.55, scout: 0.9, lander: 1.6 };

/** Palette material names in the GLB (Blender material names, `.001` suffixes allowed). */
export const LOOKS = ['panel', 'gold', 'glass', 'window_glow', 'cable_glow', 'dome'] as const;
export type Look = (typeof LOOKS)[number];
const GLOWS: ReadonlySet<Look> = new Set<Look>(['window_glow', 'cable_glow']);

/** `panel.001` → `panel`; an unknown name → null (the model's own material is kept). */
export function lookOf(materialName: string | undefined): Look | null {
  const n = (materialName ?? '').trim().toLowerCase().replace(/\.\d+$/, '');
  return (LOOKS as readonly string[]).includes(n) ? (n as Look) : null;
}

/** Double-sided twins of the solid palette materials, made once here (one extra program each, never per frame). */
const twin = (m: THREE.MeshStandardMaterial) => Object.assign(m.clone(), { side: THREE.DoubleSide });
export const TWINS: ReadonlyMap<THREE.Material, THREE.Material> = new Map<THREE.Material, THREE.Material>([
  [MAT.panel, twin(MAT.panel)],
  [MAT.gold, twin(MAT.gold)],
  [MAT.glass, twin(MAT.glass)],
]);
/** Names for merged meshes (the shared materials themselves stay unnamed). */
const LOOK_NAME = new Map<THREE.Material, string>();
for (const [m, n] of [[MAT.panel, 'panel'], [MAT.gold, 'gold'], [MAT.glass, 'glass'], [MAT.dome, 'dome']] as const) {
  LOOK_NAME.set(m, n);
  const t = TWINS.get(m);
  if (t) LOOK_NAME.set(t, `${n}_2s`);
}

/**
 * The shared material for a palette name; `lit` = the lamp's machine has batteries (like the grey lamps);
 * `bothSides` = the double-sided twin for panel, gold and glass.
 */
export function sharedMaterial(look: Look, lit: boolean, bothSides = false): THREE.Material {
  const m = singleSided(look, lit);
  return bothSides ? (TWINS.get(m) ?? m) : m;
}

function singleSided(look: Look, lit: boolean): THREE.Material {
  switch (look) {
    case 'panel':
      return MAT.panel;
    case 'gold':
      return MAT.gold;
    case 'glass':
      return MAT.glass;
    case 'dome':
      return MAT.dome;
    case 'window_glow':
      return lit ? GLOW.window : GLOW.dark;
    case 'cable_glow':
      return lit ? GLOW.cableOn : GLOW.dark;
  }
}

/** Only big bodies cast shadows (docs/layout.md): a mesh whose bounding sphere is at least this radius, in metres. */
export const SHADOW_MIN_RADIUS = 0.5;

export interface Prepared {
  root: THREE.Group;
  /** Named nodes (REQUIRED_NODES and anything else named) in this clone. */
  nodes: Map<string, THREE.Object3D>;
  /** Meshes whose material is a glow look (hidden unless `showGlow`). */
  glows: THREE.Mesh[];
  /** Material names that are not in the palette (kept as loaded; reported in dev). */
  unknown: string[];
  /** Geometries made here (merged meshes): dispose them when the model unmounts. */
  owned: THREE.BufferGeometry[];
}

type Rest = { p: THREE.Vector3; q: THREE.Quaternion; s: number };
const restOf = (o: THREE.Object3D) => o.userData.rest as Rest | undefined;
const v = new THREE.Vector3();
const sphere = new THREE.Sphere();

/**
 * Clones a loaded model scene (geometry is shared, not copied), maps its palette materials onto the shared ones,
 * scales it to `height`, merges the meshes that do not move per material (`animated` = node names kept apart),
 * sets shadows on big bodies only and records the rest pose of every named node.
 * The model's own glow meshes (`glow_*`) are hidden unless `showGlow`: the code-side lamps and windows are the glow
 * in both looks (one place, already placed for the scene's turn; no doubled lamps).
 * Called once per building (useMemo), never per frame.
 */
export type PrepareOptions = {
  /** Node names the scene moves (kept apart from the merge). */
  animated?: readonly string[];
  /** Use the double-sided twins of the palette materials. */
  bothSides?: boolean;
  /** Show the model's own glow meshes (hidden by default). */
  showGlow?: boolean;
};

/** A building as the game shows it: its height, its animated nodes, its sidedness. */
export const prepareBuilding = (b: Building, scene: THREE.Object3D) =>
  prepare(scene, HEIGHT[b], { animated: ANIMATED[b], bothSides: BOTH_SIDES.has(b) });

export function prepare(source: THREE.Object3D, height: number, opts: PrepareOptions = {}): Prepared {
  const { animated = [], bothSides = false, showGlow = false } = opts;
  const root = new THREE.Group();
  root.name = `${source.name || 'model'}_fitted`;
  root.add(source.clone(true));
  fit(root, height);
  root.updateWorldMatrix(true, true);

  const glows: Prepared['glows'] = [];
  const unknown = new Set<string>();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const looks = list.map((m) => lookOf(m?.name));
    looks.forEach((l, i) => {
      if (!l && list[i]?.name) unknown.add(list[i].name);
    });
    const mapped = list.map((m, i) => (looks[i] ? sharedMaterial(looks[i], true, bothSides) : m));
    mesh.material = Array.isArray(mesh.material) ? mapped : mapped[0];
    if (looks.some((l) => l && GLOWS.has(l))) {
      glows.push(mesh);
      mesh.visible = showGlow;
    }
  });

  const owned = mergeStatic(root, new Set(animated));
  root.updateWorldMatrix(false, true);

  const nodes = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    if (o.name && o !== root) nodes.set(o.name, o);
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Shadows: big solid bodies only; glow parts, the glass dome and small parts never.
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const solid = list.every((m) => !GLOW_MATERIALS.has(m) && m !== MAT.dome);
    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    sphere.copy(geo.boundingSphere!).applyMatrix4(mesh.matrixWorld);
    const big = solid && mesh.visible && sphere.radius >= SHADOW_MIN_RADIUS;
    mesh.castShadow = big;
    mesh.receiveShadow = big;
  });

  // Rest pose of every named node, and how many local units one metre of the model is (after fit()).
  for (const o of nodes.values()) {
    const s = o.parent ? o.parent.getWorldScale(v).y : 1;
    o.userData.rest = { p: o.position.clone(), q: o.quaternion.clone(), s: s > 0 ? s : 1 } satisfies Rest;
  }
  return { root, nodes, glows, unknown: [...unknown], owned };
}

const GLOW_MATERIALS: ReadonlySet<THREE.Material> = new Set<THREE.Material>([GLOW.window, GLOW.cableOn, GLOW.dark]);
const PALETTE: ReadonlySet<THREE.Material> = new Set<THREE.Material>([MAT.panel, MAT.gold, MAT.glass, MAT.dome, ...TWINS.values()]);

/**
 * Merges the visible palette meshes of each part that moves as one (the static model, or one animated node with
 * everything under it) into one mesh per material, in that part's own space. Positions and normals become floats
 * (the GLB's are quantized); UVs are dropped (palette materials have no maps). Returns the new geometries.
 */
function mergeStatic(root: THREE.Object3D, animated: ReadonlySet<string>): THREE.BufferGeometry[] {
  const owner = (o: THREE.Object3D): THREE.Object3D => {
    for (let p = o.parent; p; p = p.parent) if (animated.has(p.name)) return p;
    return root;
  };
  const buckets = new Map<THREE.Object3D, Map<THREE.Material, THREE.Mesh[]>>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || Array.isArray(mesh.material) || animated.has(mesh.name)) return;
    if (!PALETTE.has(mesh.material) || !mesh.geometry.attributes.position || !mesh.geometry.attributes.normal) return;
    const part = owner(mesh);
    const byMat = buckets.get(part) ?? new Map<THREE.Material, THREE.Mesh[]>();
    buckets.set(part, byMat);
    byMat.set(mesh.material, [...(byMat.get(mesh.material) ?? []), mesh]);
  });

  const owned: THREE.BufferGeometry[] = [];
  const toPart = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  for (const [part, byMat] of buckets) {
    const partInverse = part.matrixWorld.clone().invert();
    for (const [material, meshes] of byMat) {
      if (meshes.length < 2) continue;
      let vertices = 0;
      let indices = 0;
      for (const m of meshes) {
        vertices += m.geometry.attributes.position.count;
        indices += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
      }
      const position = new Float32Array(vertices * 3);
      const normal = new Float32Array(vertices * 3);
      const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
      let vo = 0;
      let io = 0;
      for (const m of meshes) {
        const g = m.geometry;
        const pos = g.attributes.position;
        const nor = g.attributes.normal;
        toPart.multiplyMatrices(partInverse, m.matrixWorld);
        normalMatrix.getNormalMatrix(toPart);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(toPart).toArray(position, (vo + i) * 3);
          v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize().toArray(normal, (vo + i) * 3);
        }
        const flip = toPart.determinant() < 0; // a mirrored node turns its triangles inside out: keep them facing out
        const count = g.index ? g.index.count : pos.count;
        for (let i = 0; i < count; i += 3) {
          const a = g.index ? g.index.getX(i) : i;
          const b = g.index ? g.index.getX(i + 1) : i + 1;
          const c = g.index ? g.index.getX(i + 2) : i + 2;
          index[io++] = vo + a;
          index[io++] = vo + (flip ? c : b);
          index[io++] = vo + (flip ? b : c);
        }
        vo += pos.count;
        m.removeFromParent();
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
      merged.setIndex(new THREE.BufferAttribute(index, 1));
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${part === root ? 'static' : part.name}_${LOOK_NAME.get(material) ?? 'merged'}`;
      part.add(mesh);
      owned.push(merged);
    }
  }
  return owned;
}

/** What is wrong with a loaded kit; empty = all six can be used. A missing file never reaches here (load fails). */
export function kitProblems(scenes: Partial<Record<Building, THREE.Object3D | undefined>>): string[] {
  const problems: string[] = [];
  for (const b of BUILDINGS) {
    const scene = scenes[b];
    if (!scene) {
      problems.push(`${b}: missing`);
      continue;
    }
    for (const n of REQUIRED_NODES[b]) if (!scene.getObjectByName(n)) problems.push(`${b}: no node ${n}`);
  }
  return problems;
}

// ---- motion helpers: called from useFrame, allocation-free; they set the pose from the rest pose ----

const q = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

/** Moves a node up by `h` metres from its rest place (lander_body at lift-off). */
export function lift(node: THREE.Object3D, h: number) {
  const r = restOf(node);
  if (r) node.position.y = r.p.y + h / r.s;
}

/** Turns a node about the vertical axis through its pivot by `a` radians from rest (dish_head). */
export function yaw(node: THREE.Object3D, a: number) {
  const r = restOf(node);
  if (r) node.quaternion.multiplyQuaternions(q.setFromAxisAngle(Y, a), r.q);
}

/** Rolls a node about the model's side axis (X; the front is +Z) through its pivot (scout wheels, axle centre). */
export function spin(node: THREE.Object3D, a: number) {
  const r = restOf(node);
  if (r) node.quaternion.multiplyQuaternions(q.setFromAxisAngle(X, a), r.q);
}
