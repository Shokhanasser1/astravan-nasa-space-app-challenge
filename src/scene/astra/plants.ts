import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The greenhouse's plants follow the garden level (View.plant 0–4, a game rule): 4 all lush, 3 most, 2 half and
 * paler, 1 a few yellow-brown ones, 0 empty troughs. ASTRA builds each plant in its own group (life.ts, `HB7:`);
 * here they become ONE vertex-coloured mesh (one draw call for all of them), laid out plant by plant in the order
 * they go: a level shows the first plants only (a draw range, so a missing plant costs nothing), and the fragment
 * shader turns them paler or yellow-brown. A level change is three numbers, never a rebuild.
 */

/** How many of the 18 plants stand at each garden level (game level → scene look). */
const COUNT = [0, 4, 9, 14, 18];
/** Per level: how far the plants' own colours turn to the wilt colour (lush green → paler → yellow-brown). */
const WILT: { to: string; k: number }[] = [
  { to: '#8a6526', k: 0.75 },
  { to: '#8a6526', k: 0.75 },
  { to: '#b9c27a', k: 0.45 },
  { to: '#a9c27a', k: 0.15 },
  { to: '#a9c27a', k: 0 },
];
/** The plants (ASTRA's order: two troughs of nine) in the order they stay: the last to go are spread over both troughs. */
const ORDER = [0, 13, 4, 9, 16, 2, 11, 6, 15, 8, 17, 1, 10, 5, 14, 3, 12, 7];

export type Plants = { mesh: THREE.Mesh; setLevel: (level: number) => void };

export function mergePlants(group: THREE.Group): Plants {
  const plants = [...group.children];
  const n = plants.length;
  const order = [...ORDER.filter((i) => i < n), ...plants.map((_, i) => i).filter((i) => !ORDER.includes(i))];
  group.updateMatrixWorld(true);
  const toGroup = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const m4 = new THREE.Matrix4();
  const geos: THREE.BufferGeometry[] = [];
  const ends: number[] = []; // vertices drawn when the first k + 1 plants show
  let total = 0;
  for (const i of order) {
    plants[i].traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const src = mesh.geometry;
      const g = src.index ? src.toNonIndexed() : src.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      g.morphAttributes = {};
      g.clearGroups();
      const count = g.getAttribute('position').count;
      const c = (mesh.material as THREE.MeshStandardMaterial).color ?? new THREE.Color('#4e9b3e');
      const col = new Float32Array(count * 3);
      for (let v = 0; v < count; v++) col.set([c.r, c.g, c.b], v * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.applyMatrix4(m4.multiplyMatrices(toGroup, mesh.matrixWorld));
      geos.push(g);
      total += count;
    });
    ends.push(total);
  }
  for (const p of plants) p.removeFromParent();
  const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
  geos.forEach((g) => g.dispose());

  const wiltTo = { value: new THREE.Color() };
  const wilt = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWiltTo = wiltTo;
    sh.uniforms.uWilt = wilt;
    sh.fragmentShader = `uniform vec3 uWiltTo;\nuniform float uWilt;\n${sh.fragmentShader}`.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uWiltTo, uWilt);',
    );
  };
  mat.customProgramCacheKey = () => 'hb7-plants';
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'hb7_plants'; // (not `astra_`: AstraMerge must not fold it into the plain paints)
  mesh.userData.moves = true;
  mesh.castShadow = false; // plants do not cast (docs/layout.md)
  mesh.receiveShadow = true;
  group.add(mesh);

  return {
    mesh,
    setLevel(level: number) {
      const l = Math.max(0, Math.min(4, Math.round(level)));
      const k = Math.min(COUNT[l], ends.length);
      merged.setDrawRange(0, k > 0 ? ends[k - 1] : 0);
      mesh.visible = k > 0;
      wiltTo.value.set(WILT[l].to);
      wilt.value = WILT[l].k;
    },
  };
}
