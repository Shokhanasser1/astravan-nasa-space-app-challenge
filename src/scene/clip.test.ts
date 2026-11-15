// A decor machine's clip (the crew rover's Drive, RASSOR's Dig) must keep playing after React's StrictMode runs its
// effect, the cleanup, and the effect again (`npm run dev`): before 15 Nov the rover's wheels stood still there.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { playClip } from './clip';

describe('playClip', () => {
  const clip = new THREE.AnimationClip('Spin', 2, [new THREE.NumberKeyframeTrack('.position[x]', [0, 2], [0, 2])]);

  it('still plays after an effect, its cleanup and the effect again (StrictMode)', () => {
    const root = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(root);
    playClip(mixer, clip)(); // mount, then StrictMode's cleanup
    const stop = playClip(mixer, clip); // mount again
    mixer.update(0.5);
    expect(root.position.x).toBeCloseTo(0.5);
    mixer.timeScale = 2; // the rover at 2 m/s
    mixer.update(0.25);
    expect(root.position.x).toBeCloseTo(1.0);
    stop(); // unmount
    expect(mixer.existingAction(clip)?.isRunning()).toBe(false);
  });
});
