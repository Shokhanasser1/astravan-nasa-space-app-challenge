/**
 * The robot arm's shared state: the scanner UI (src/ui/play/ArmScanner.tsx) writes the targets, the scene
 * (src/scene/RobotArm.tsx, src/scene/Astronaut.tsx) moves the arm and the remote and writes back what is shown and
 * whether the astronaut stands near the arm. Plain object, read every frame; React subscribes only to on/near.
 */
export interface ArmAngles {
  lift: number;
  bend: number;
  wrist: number;
  open: number;
}

/** The model's rest: upper arm level, forearm up, turret in line, jaws open. */
export const REST: ArmAngles = { lift: 0, bend: 90, wrist: 0, open: 1 };

export const armState = {
  /** The scanner is on (the arm follows the player's hand; the astronaut holds the remote). */
  on: false,
  /** The astronaut stands near the arm (the scanner's button shows). */
  near: false,
  /** Where the astronaut is (written by Astronaut.tsx). */
  player: { x: 0, z: 0 },
  /** What the scanner asks for. */
  target: { ...REST },
  /** What the arm shows: the target eased and kept out of the ground (kin.ts). */
  shown: { ...REST },
  /** The ground or the pedestal stopped the arm short of the target. */
  held: false,
};

const listeners = new Set<() => void>();
let version = 0;

export function subscribeArm(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** Changes when on or near changes (for useSyncExternalStore). */
export const armVersion = (): number => version;

function changed() {
  version++;
  for (const l of listeners) l();
}

export function setArmOn(on: boolean): void {
  if (armState.on === on) return;
  armState.on = on;
  if (!on) armState.target = { ...REST };
  changed();
}

export function setArmNear(near: boolean): void {
  if (armState.near === near) return;
  armState.near = near;
  changed();
}
