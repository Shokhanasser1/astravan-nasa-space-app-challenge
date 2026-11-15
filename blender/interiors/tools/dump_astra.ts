// Dump ASTRA's procedural building shells (as used in HOME BY SEVEN main) to JSON meshes for Blender reference.
// Run from the game copy: node_modules/.bin/jiti <this> <outdir>
const noop = () => {};
const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop), set: () => true });
(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) };
import * as THREE from 'three';
import { writeFileSync, mkdirSync } from 'node:fs';
import { finalize, light, setLod } from '../../../../astravan-interiors/src/vendor/astra/scene/kit';
import { buildHabitat } from '../../../../astravan-interiors/src/vendor/astra/scene/models/habitat';
import { buildGreenhouse } from '../../../../astravan-interiors/src/vendor/astra/scene/models/life';
import { buildLander } from '../../../../astravan-interiors/src/vendor/astra/scene/models/site';
import { buildLab } from '../../../../astravan-interiors/src/vendor/astra/scene/models/works';

setLod(1);
const out = process.argv[2];
mkdirSync(out, { recursive: true });
function view() {
  return { group: new THREE.Group(), status: light('#3ee39a'), glow: [], spin: [], blink: [], top: 2.5 } as any;
}
function dump(name: string, g: THREE.Object3D) {
  finalize(g as any);
  g.updateMatrixWorld(true);
  const meshes: any[] = [];
  g.traverse((o: any) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const geom = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const p = geom.attributes.position.array as Float32Array;
    const idx = geom.index ? Array.from(geom.index.array as any) : [...Array(p.length / 3).keys()];
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    meshes.push({ name: o.name || '', parent: o.parent?.name || '', color: m?.color ? '#' + m.color.getHexString() : '#888888', emissive: m?.emissive ? '#' + m.emissive.getHexString() : null, opacity: m?.opacity ?? 1, transparent: !!m?.transparent, pos: Array.from(p).map((v) => +v.toFixed(4)), idx });
  });
  const box = new THREE.Box3().setFromObject(g);
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ name, bbox: { min: box.min.toArray(), max: box.max.toArray() }, meshes }));
  console.log(name, meshes.length, 'meshes', box.min.toArray().map((v) => v.toFixed(2)), box.max.toArray().map((v) => v.toFixed(2)));
}
{ const v = view(); buildHabitat(v, 'moon'); dump('habitat', v.group); }
{ const v = view(); buildGreenhouse(v); dump('greenhouse', v.group); }
{ const v = view(); buildLab(v); dump('lab', v.group); }
{ const l = buildLander('moon'); dump('lander', l); }
