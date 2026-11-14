// Copies the Draco decoder from the installed three.js into public/draco/ (git-ignored), so models compressed
// with `gltfjsx --transform` load without Google's CDN — the venue Wi-Fi may be down (developer guide §06).
// Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const from = join(root, 'node_modules/three/examples/jsm/libs/draco/gltf');
const to = join(root, 'public/draco');
if (!existsSync(from)) {
  console.warn('copy-decoders: three.js Draco decoder not found (run npm install)');
} else {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

// MediaPipe hand tracking (?hands, src/hand/): its WASM from our own server, never a CDN. Only the SIMD build
// (14 MB; every current browser has SIMD). Loaded only when the child turns the camera on; not precached.
const mpFrom = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const mpTo = join(root, 'public/mediapipe');
if (existsSync(mpFrom)) {
  mkdirSync(mpTo, { recursive: true });
  for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) cpSync(join(mpFrom, f), join(mpTo, f));
}
