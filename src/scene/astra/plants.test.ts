import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergePlants } from './plants';

/** 18 plants of one box each (36 vertices non-indexed), as ASTRA's greenhouse lays them out (one group per plant). */
function greenhouse() {
  const g = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: '#4e9b3e' }));
    m.position.set(-1.75 + (i % 9) * 0.44, 0.6, i < 9 ? -0.62 : 0.62);
    p.add(m);
    g.add(p);
  }
  return g;
}

describe('greenhouse plants follow the garden level', () => {
  it('become one mesh, and each level draws only its plants', () => {
    const g = greenhouse();
    const plants = mergePlants(g);
    expect(g.children).toEqual([plants.mesh]);
    const per = 36;
    for (const [level, count] of [[4, 18], [3, 14], [2, 9], [1, 4]] as const) {
      plants.setLevel(level);
      expect(plants.mesh.visible).toBe(true);
      expect(plants.mesh.geometry.drawRange.count, `level ${level}`).toBe(count * per);
    }
    plants.setLevel(0);
    expect(plants.mesh.visible).toBe(false);
  });

  it('keeps the last plants spread over both troughs', () => {
    const g = greenhouse();
    const plants = mergePlants(g);
    plants.setLevel(1);
    const pos = plants.mesh.geometry.getAttribute('position');
    const zs = new Set<number>();
    for (let v = 0; v < plants.mesh.geometry.drawRange.count; v++) zs.add(Math.sign(pos.getZ(v)));
    expect(zs).toEqual(new Set([-1, 1]));
  });
});
