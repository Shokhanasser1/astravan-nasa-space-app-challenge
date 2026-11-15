import { useEffect, useMemo, useRef } from 'react';
import { invalidate, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { ArmRig } from '../arm/rig';
import { armState, setArmNear } from '../arm/state';
import { listenArmKeys, stepArmKeys } from '../arm/keys';
import { groundHeight } from './ground';
import { PARKED_ROVER } from './layout';
import { rover } from './arrival';
import { ArmCargo, type CargoStep } from './ArmCargo';

/** Curiosity's robotic arm, cut into three moving parts (scripts/models/curiosity_arm.py), 330 kB, ~5k triangles. */
const URL = `${import.meta.env.BASE_URL}models/curiosity-arm/curiosity-arm.glb`;

/**
 * Where the arm sits on the crew rover (sev.glb, its own frame: front +Z, left +X; measured 15 Nov: 3.1 × 4.5 m, the
 * roof's top 2.62 m up at the middle): a little behind the middle of the roof, reaching forward. The roof around it
 * (2.25 m back to front ends, 1.55 m to each side, less the rounded edges) is its floor.
 */
const MOUNT = { x: 0, y: 2.6, z: -0.5 } as const;
const ON_ROVER = { scale: 2.4, shoulder: 0.42, deck: { back: 1.6, front: 2.6, halfW: 1.1 } };
/** m from the rover: within this the arm's controls show (on foot beside it, or in the driver's seat). */
const NEAR = 8;

/**
 * Curiosity's robot arm on the crew rover's roof (15 Nov, Shoxjahon aka: "on the car, controlled from inside and
 * outside, longer, four claws twice as big"). It rides with the rover (a child of its model: it drives, pitches and
 * rolls with it), follows the scanner's targets or the arm keys (src/arm/state.ts, src/arm/keys.ts), eased and never
 * into the roof or the ground (src/arm/kin.ts), and rests when nobody drives it. Tells the HUD when the astronaut is
 * near the rover or in it (the scanner's button and the keys work only then). Without a drivable rover model (phones
 * without ?drive) it stands on the parked rover's roof, in the same place.
 */
export function RobotArm() {
  const gltf = useGLTF(URL);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const rig = useMemo(() => new ArmRig(gltf.scene.clone(true), ON_ROVER), [gltf]);
  const shadowT = useRef(0);
  const last = useRef({ x: NaN, z: NaN, yaw: NaN });
  /** The rocks and boxes it lifts (ArmCargo.tsx): stepped after the arm has moved, so a held one keeps to the claws. */
  const cargo = useRef<CargoStep | null>(null);
  useEffect(() => {
    rig.setGround(groundHeight);
    listenArmKeys(invalidate);
    gl.shadowMap.needsUpdate = true; // the once-a-day shadow map must include it
    invalidate();
    return () => {
      rig.root.removeFromParent();
      rig.dispose();
    };
  }, [rig, gl]);
  useEffect(() => () => setArmNear(false), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    // on the rover: under its model once that has loaded (Decor), else on the parked rover's roof
    const host = rover.object;
    if (host && rig.root.parent !== host) {
      host.add(rig.root);
      rig.root.position.set(MOUNT.x, MOUNT.y, MOUNT.z);
      rig.root.rotation.set(0, 0, 0);
    } else if (!host && rig.root.parent !== scene) {
      scene.add(rig.root);
      const { x, z, yaw } = PARKED_ROVER;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const wx = x + MOUNT.x * c + MOUNT.z * s, wz = z - MOUNT.x * s + MOUNT.z * c;
      rig.place(wx, groundHeight(x, z) + MOUNT.y, wz, yaw, groundHeight);
    }
    // the rover drove on: the ground under the reach changed
    const L = last.current;
    const drove = L.x !== rover.x || L.z !== rover.z || L.yaw !== rover.yaw;
    if (drove) {
      L.x = rover.x;
      L.z = rover.z;
      L.yaw = rover.yaw;
      rig.refresh();
    }
    const keys = stepArmKeys(dt);
    rig.set(armState.target);
    const moving = rig.update(dt) || keys;
    armState.shown = rig.shown;
    armState.held = rig.held();
    const lifting = cargo.current ? cargo.current(dt, rig.shown.open) : false;
    const p = armState.player;
    setArmNear(Math.hypot(p.x - rover.x, p.z - rover.z) < NEAR);
    if (!moving && !lifting) return;
    // the Sun's shadow map is drawn once a day; while the arm moves, redraw it ten times a second (like Rig.tsx)
    shadowT.current -= dt;
    if (shadowT.current <= 0) {
      shadowT.current = 0.1;
      gl.shadowMap.needsUpdate = true;
    }
    invalidate();
  });

  return <ArmCargo rig={rig} stepRef={cargo} />;
}

useGLTF.preload(URL);
