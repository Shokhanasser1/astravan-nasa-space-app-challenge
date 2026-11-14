import * as THREE from 'three';

const box = new THREE.Box3();
const size = new THREE.Vector3();
const toParent = new THREE.Matrix4();

/**
 * Scales a loaded model uniformly to its real height in metres and stands it on the ground: its lowest point ends
 * at y = 0 of its parent. X and Z are kept, because our models have their origin at the base centre (docs/layout.md,
 * docs/specs/2026-11-14-nasa-models.md). Call it once after loading (never in useFrame). Returns the scale factor;
 * an empty or flat object is left as it is (factor 1).
 */
export function fit(object: THREE.Object3D, height: number): number {
  object.updateWorldMatrix(true, true);
  box.setFromObject(object, true);
  if (object.parent) box.applyMatrix4(toParent.copy(object.parent.matrixWorld).invert());
  if (box.isEmpty()) return 1;
  box.getSize(size);
  if (!(size.y > 1e-6) || !(height > 0)) return 1;
  const k = height / size.y;
  // Scaling happens about the object's own origin: a point at y (parent space) moves to p + k (y − p).
  const p = object.position.y;
  object.scale.multiplyScalar(k);
  object.position.y = k * (p - box.min.y);
  object.updateWorldMatrix(false, true);
  return k;
}
