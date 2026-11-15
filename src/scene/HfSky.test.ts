import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { skyOrientation } from './HfSky';
import { TITLE, titlePose } from './title';

describe('HfSky orientation', () => {
  it('puts the galactic core at the skyline, 28° right of the title camera', () => {
    const q = skyOrientation();
    expect(Math.abs(q.length() - 1)).toBeLessThan(1e-6);
    const phi = 2 * Math.PI * 0.38, th = Math.PI * 0.55;
    const core = new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)).applyQuaternion(q);
    expect(THREE.MathUtils.radToDeg(Math.asin(core.y))).toBeCloseTo(-3, 1);
    const cam = titlePose(0, true, { x: 0, y: 0, z: 0 });
    const f = new THREE.Vector2(TITLE.target[0] - cam.x, TITLE.target[2] - cam.z).normalize();
    const c = new THREE.Vector2(core.x, core.z).normalize();
    expect(THREE.MathUtils.radToDeg(Math.acos(f.dot(c)))).toBeCloseTo(28, 0);
  });
});
