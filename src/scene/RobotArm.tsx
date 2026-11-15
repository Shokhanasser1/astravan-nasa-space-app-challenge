import { useEffect, useMemo, useRef } from 'react';
import { invalidate, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { ArmRig } from '../arm/rig';
import { armState, setArmNear } from '../arm/state';
import { groundHeight } from './ground';
import { ROBOT_ARM } from './layout';

/** Curiosity's robotic arm, cut into three moving parts (scripts/models/curiosity_arm.py), 330 kB, ~5k triangles. */
const URL = `${import.meta.env.BASE_URL}models/curiosity-arm/curiosity-arm.glb`;

/**
 * The robot arm on the east edge of the base (layout ROBOT_ARM). It follows the scanner's targets (src/arm/state.ts,
 * written by src/ui/play/ArmScanner.tsx), eased and never into the ground (src/arm/kin.ts), and rests when the scanner
 * is off. Tells the HUD when the astronaut stands near it (the scanner's button shows only then).
 */
export function RobotArm() {
  const gltf = useGLTF(URL);
  const gl = useThree((s) => s.gl);
  const rig = useMemo(() => new ArmRig(gltf.scene.clone(true)), [gltf]);
  const shadowT = useRef(0);
  useEffect(() => {
    rig.place(ROBOT_ARM.x, groundHeight(ROBOT_ARM.x, ROBOT_ARM.z), ROBOT_ARM.z, ROBOT_ARM.yaw, groundHeight);
    gl.shadowMap.needsUpdate = true; // the once-a-day shadow map must include it
    invalidate();
    return () => rig.dispose();
  }, [rig, gl]);
  useEffect(() => () => setArmNear(false), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    rig.set(armState.target);
    const moving = rig.update(dt);
    armState.shown = rig.shown;
    armState.held = rig.held();
    const p = armState.player;
    setArmNear(Math.hypot(p.x - ROBOT_ARM.x, p.z - ROBOT_ARM.z) < ROBOT_ARM.near);
    if (!moving) return;
    // the Sun's shadow map is drawn once a day; while the arm moves, redraw it ten times a second (like Rig.tsx)
    shadowT.current -= dt;
    if (shadowT.current <= 0) {
      shadowT.current = 0.1;
      gl.shadowMap.needsUpdate = true;
    }
    invalidate();
  });

  return <primitive object={rig.root} />;
}

useGLTF.preload(URL);
