import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addDetail, type Detail } from '../../vendor/astra/scene/surface';

/**
 * Bake a procedural model (ASTRA's builders make hundreds of small meshes) into a few meshes, so the whole base
 * fits the phone budget (~50 draw calls): plain paints become one vertex-coloured mesh per finish (roughness,
 * metalness, side; ASTRA's triplanar surface detail, `addDetail`, is put back on the merged paint); textured,
 * transparent, other custom-shader and live materials (glow, lamps, windows: power changes
 * them) merge only with themselves. Parts in `keep` (anything that moves or shows step by step) stay as they are.
 * Call once, right after building, while the root has no transform of its own.
 */
export function bake(root: THREE.Object3D, opts: { keep: THREE.Object3D[]; live: THREE.Material[] }): void {
  const keep = new Set(opts.keep);
  const live = new Set(opts.live);
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; colored: boolean; shadow: boolean }>();
  const drop: THREE.Mesh[] = [];
  const m4 = new THREE.Matrix4();

  const visit = (o: THREE.Object3D) => {
    if (keep.has(o) || !o.visible) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh && !Array.isArray(mesh.material)) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const plain = isPlain(mat) && !live.has(mat);
      const detail = mat.userData?.detail as Detail | undefined;
      const key = plain
        ? `vc|${rough(mat.roughness)}|${metal(mat.metalness)}|${mat.side}|${mat.flatShading ? 1 : 0}|${detail ? JSON.stringify(detail) : ''}`
        : `m|${mat.uuid}`;
      let grp = groups.get(key);
      if (!grp) {
        let shared: THREE.Material = mat;
        if (plain) {
          const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough(mat.roughness), metalness: metal(mat.metalness), side: mat.side, flatShading: mat.flatShading });
          shared = detail ? addDetail(m, detail) : m;
        }
        grp = { mat: shared, geos: [], colored: plain, shadow: false };
        groups.set(key, grp);
      }
      const geo = clean(mesh.geometry, plain ? mat.color : null);
      geo.applyMatrix4(m4.multiplyMatrices(toRoot, mesh.matrixWorld));
      grp.geos.push(geo);
      grp.shadow ||= mesh.castShadow;
      drop.push(mesh);
    }
    for (const c of [...o.children]) visit(c);
  };
  for (const c of [...root.children]) visit(c);

  for (const m of drop) m.removeFromParent();
  for (const g of groups.values()) {
    const merged = mergeGeometries(g.geos, false);
    g.geos.forEach((x) => x.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, g.mat);
    mesh.castShadow = g.shadow;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

// Finishes in coarse steps (roughness by 0.25, metal or not): a few more merges, a difference hard to see.
const rough = (v: number) => Math.min(1, Math.max(0.15, Math.round((v ?? 0.6) * 4) / 4));
const metal = (v: number) => ((v ?? 0) >= 0.5 ? 0.85 : (v ?? 0) >= 0.2 ? 0.3 : 0.05);

/** A plain paint: one colour, no texture, no transparency, no custom shader code, not glowing. */
function isPlain(m: THREE.Material): boolean {
  const s = m as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial || s.transparent || s.map || s.alphaMap || s.normalMap || s.roughnessMap || s.emissiveMap) return false;
  // custom shader code: only ASTRA's surface detail is known (and re-applied after merging)
  if (s.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && !s.userData?.detail) return false;
  if (s.emissiveIntensity > 0 && (s.emissive.r > 0 || s.emissive.g > 0 || s.emissive.b > 0)) return false;
  return true;
}

/** Non-indexed copy with exactly position + normal + (uv, or the paint's colour per vertex). */
function clean(src: THREE.BufferGeometry, color: THREE.Color | null): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  if (color) {
    g.deleteAttribute('uv');
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  } else if (!g.getAttribute('uv')) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}
