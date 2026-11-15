import * as THREE from 'three';

/**
 * Phones: only big bodies cast shadows (.claude/rules/three.md). The Sun's shadow map is redrawn five times a second
 * while the astronaut walks (Rig.tsx) and every caster is one more draw call in it: on 15 Nov the phone drew ~155
 * casters (160k triangles) per redraw, most of them bolts, wheels and arm joints whose shadow is 3–6 texels of a 1024
 * map. A part whose world bounding radius (metres) is under this stops casting; it still receives shadows.
 */
export const SMALL_CASTER_M = 0.4;

const scale = new THREE.Vector3();

/**
 * Turns `castShadow` off on every mesh under `root` smaller than `minRadius`. Skinned meshes (the astronaut) and
 * instanced ones (rocks, sandbags: one draw call for all) are left alone. Each mesh is looked at once. Returns how
 * many stopped casting (then the shadow map needs a redraw).
 */
export function trimCasters(root: THREE.Object3D, minRadius: number): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.castShadow || m.userData.casterChecked) return;
    m.userData.casterChecked = true;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh || (o as THREE.InstancedMesh).isInstancedMesh) return;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    m.updateWorldMatrix(true, false);
    m.getWorldScale(scale);
    if ((g.boundingSphere?.radius ?? 0) * Math.max(scale.x, scale.y, scale.z) < minRadius) {
      m.castShadow = false;
      n++;
    }
  });
  return n;
}
