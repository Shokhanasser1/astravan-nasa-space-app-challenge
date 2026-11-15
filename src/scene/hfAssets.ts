import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Loaders for the AI graphics pack (features.hfGround / hfRocks; files in public/hf/, made by scripts/hf/). Every
 * loader resolves to null on any failure, so the caller simply keeps the code-made look.
 */
const base = () => `${import.meta.env.BASE_URL}hf/`;

function tex(url: string, renderer: THREE.WebGLRenderer): Promise<THREE.Texture | null> {
  return new Promise((done) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.NoColorSpace; // data, not colour: the regolith shader reads raw values (mean 0.5)
        t.flipY = false; // rows run along +z like the code-made DataTextures, so the slope's sign matches
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        t.needsUpdate = true;
        done(t);
      },
      undefined,
      () => done(null),
    );
  });
}

/**
 * The regolith from two AI photo-textures, the same contract as src/look/textures.js regolithTextures (albedo grey with
 * mean 0.5, the shader doubles it; slope RG = surface tilt from the photo's relief): the close-up (one tile ≈ 2.7 m:
 * grains, pebbles, pits) and the macro layer (one tile ≈ 14 m: craterlets with brighter ejecta, scattered stones).
 */
export async function loadHfRegolith(renderer: THREE.WebGLRenderer, pc: boolean) {
  const size = pc ? '1k' : '512';
  const all = await Promise.all([
    tex(`${base()}ground/regolith-albedo-${size}.webp`, renderer),
    tex(`${base()}ground/regolith-slope-${size}.webp`, renderer),
    tex(`${base()}ground/macro-albedo-${size}.webp`, renderer),
    tex(`${base()}ground/macro-slope-${size}.webp`, renderer),
  ]);
  if (all.some((t) => !t)) {
    for (const t of all) t?.dispose();
    return null;
  }
  const [albedo, slope, macro, macroSlope] = all as THREE.Texture[];
  return { albedo, slope, macro, macroSlope };
}

export interface HfRock {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/**
 * One AI boulder, fitted to the code-made rock's frame (src/look/rocks.js rockGeometry): centred, ±1 across, a flat
 * base at y = −0.3 sitting in the soil and the top at y ≈ 0.79, so the placements, hitboxes and shadows planned for
 * the old rocks fit it unchanged.
 */
export function loadHfRock(name: string): Promise<HfRock | null> {
  return new Promise((done) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      `${base()}rocks/${name}.glb`,
      (gltf) => {
        let found: THREE.Mesh | null = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
        });
        if (!found) return done(null);
        const mesh = found as THREE.Mesh;
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        geometry.computeBoundingBox();
        const b = geometry.boundingBox!;
        const c = b.getCenter(new THREE.Vector3());
        geometry.translate(-c.x, -b.min.y, -c.z);
        const half = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
        const h = b.max.y - b.min.y;
        // ±1 across; height to 1.09 (from −0.3 to 0.79), like the old rocks
        geometry.scale(1 / half, 1.09 / h, 1 / half);
        geometry.translate(0, -0.3, 0);
        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const material = (src as THREE.MeshStandardMaterial).clone();
        if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const m = material as THREE.MeshStandardMaterial;
          m.metalness = 0;
          m.roughness = Math.max(m.roughness, 0.9);
          m.envMapIntensity = 0.4;
        }
        done({ geometry, material });
      },
      undefined,
      () => done(null),
    );
  });
}
