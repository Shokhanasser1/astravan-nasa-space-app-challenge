import type * as THREE from 'three';

/**
 * Plays `clip` on `mixer` from its start and returns its stop — meant as a React effect and its cleanup. Started in
 * the effect, never in a useMemo: React's StrictMode (`npm run dev`) runs every effect's cleanup once and the effect
 * again, and a clip started in a memo stayed stopped after that cleanup (the crew rover's wheels never turned).
 */
export function playClip(mixer: THREE.AnimationMixer, clip: THREE.AnimationClip): () => void {
  const action = mixer.clipAction(clip).reset().play();
  return () => void action.stop();
}
