import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { glareTexture } from '../look/textures.js';
import { sunDirection } from './Light';
import { TITLE, titlePose } from './title';

/**
 * The night sky as one all-sky picture (features.hfGraphics.sky): the Milky Way with its dust lanes and star clouds,
 * on a sphere that follows the camera (so it sits at infinity, behind the skyline, Earth and the Sun).
 * AI-made picture (Higgsfield, FLUX 3; docs/AI-USE.md, CREDITS.md), not a star catalogue: a game look, not a sky map.
 *
 * The band (horizontal in the picture) is turned to arc up over the base instead of lying on the horizon.
 * Until the picture has loaded (or if it fails), the caller keeps drei's point stars.
 *
 * The picture is drawn before everything else with no depth, darkened so that after the scene's exposure (3.3,
 * Stage.tsx) the black stays black and only the brightest stars reach Bloom.
 */
const R = 2700; // m: behind the stars (2.4 km) and Earth (2.3 km), inside the camera's far plane (3 km)
/**
 * Turned so that, from the title camera at the middle of its arc (src/scene/title.ts, the reception desk's view), the
 * galactic core sits 28° right of centre just at the skyline and the band climbs 24° to the left across the top of the
 * view. Worked out from the title shot itself, so a new title camera keeps the Milky Way in frame.
 * Picture frame: the core is at u 0.38, v 0.55 of the panorama; the band runs along u.
 */
export function skyOrientation(): THREE.Quaternion {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const up = V(0, 1, 0);
  const cam = titlePose(0, true, { x: 0, y: 0, z: 0 });
  const [tx, ty, tz] = TITLE.target;
  const d = V(tx - cam.x, ty - cam.y, tz - cam.z).normalize();
  const f = V(d.x, 0, d.z).normalize();
  const right = V().crossVectors(f, up).normalize();
  const rad = THREE.MathUtils.degToRad;
  const [yaw, el, al] = [rad(28), rad(-3), rad(24)];
  const cw = f.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(right, Math.sin(yaw)).multiplyScalar(Math.cos(el)).addScaledVector(up, Math.sin(el)).normalize();
  const rc = V().crossVectors(cw, up).normalize();
  const upP = V().crossVectors(rc, cw);
  const bw = rc.clone().multiplyScalar(-Math.cos(al)).addScaledVector(upP, Math.sin(al)).normalize();
  const nw = V().crossVectors(cw, bw);
  // the same three directions in the picture (SphereGeometry's uv: u around from −x, v down from +y)
  const phi = 2 * Math.PI * 0.38, th = Math.PI * 0.55;
  const ct = V(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
  const bt = V(Math.sin(phi), 0, Math.cos(phi));
  bt.addScaledVector(ct, -bt.dot(ct)).normalize();
  const nt = V().crossVectors(ct, bt);
  const world = new THREE.Matrix4().makeBasis(cw, bw, nw);
  const pic = new THREE.Matrix4().makeBasis(ct, bt, nt);
  return new THREE.Quaternion().setFromRotationMatrix(world.multiply(pic.transpose()));
}
const ORIENT = skyOrientation();

export function HfSky({ big, gain = 0.3, onReady }: { big: boolean; gain?: number; onReady?: (ok: boolean) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const [map, setMap] = useState<THREE.Texture | null>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    let alive = true;
    const url = `${import.meta.env.BASE_URL}hf/sky/milkyway-${big ? '4k' : '2k'}.webp`;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (!alive) return t.dispose();
        t.colorSpace = THREE.SRGBColorSpace;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.anisotropy = 4;
        setMap(t);
        ready.current?.(true);
        invalidate();
      },
      undefined,
      () => ready.current?.(false),
    );
    return () => {
      alive = false;
    };
  }, [big, invalidate]);
  useEffect(() => () => map?.dispose(), [map]);

  const geo = useMemo(() => new THREE.SphereGeometry(R, 96, 48), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(({ camera }) => mesh.current?.position.copy(camera.position));

  if (!map) return null;
  return (
    <mesh ref={mesh} geometry={geo} quaternion={ORIENT} renderOrder={-10} frustumCulled={false}>
      <meshBasicMaterial
        map={map}
        color={new THREE.Color(gain, gain, gain)}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        fog={false}
      />
    </mesh>
  );
}

/**
 * The Sun itself (features.hfSky): no air, so a hard white disc 0.53° across in a black sky, with the lens's glare
 * around it. Drawn bright (HDR) so Bloom catches it; hidden behind hills and buildings by the depth test.
 */
const SUN_D = 2600;
const SUN_SIZE = (SUN_D * Math.tan(THREE.MathUtils.degToRad(0.53))) / 0.18; // the glare texture's core is 0.18 of it

export function HfSun({ azDeg }: { azDeg: number }) {
  const tex = useMemo(() => glareTexture(256), []);
  useEffect(() => () => tex.dispose(), [tex]);
  const sprite = useRef<THREE.Sprite>(null);
  const dir = useMemo(() => sunDirection(azDeg, new THREE.Vector3()), [azDeg]);
  useFrame(({ camera }) => sprite.current?.position.copy(camera.position).addScaledVector(dir, SUN_D));
  return (
    <sprite ref={sprite} scale={[SUN_SIZE, SUN_SIZE, 1]} renderOrder={-5} frustumCulled={false}>
      <spriteMaterial map={tex} color={new THREE.Color(6, 5.8, 5.4)} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
    </sprite>
  );
}
