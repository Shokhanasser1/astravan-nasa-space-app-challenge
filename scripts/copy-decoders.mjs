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
