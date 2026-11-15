/**
 * The robot arm by keyboard (15 Nov, Shoxjahon aka: "drive it from inside the rover and from outside"): next to the
 * rover, on foot or at the wheel, while the camera scanner is off. Free keys only (W A S D drive and walk, E Q C K H M
 * are taken): R / F lift, T / G bend the elbow, U / J the wrist, Z / X turn the roof turret, V opens or closes the
 * four claws. Held keys move the target at a steady rate; src/scene/RobotArm.tsx eases the arm after it.
 */
import { armState } from './state';
import { walkInput } from '../walk/input';
import { BEND, LIFT, TURN, WRIST } from './reach';

/** Degrees per second while a key is held. */
const RATE = { lift: 45, bend: 60, wrist: 80, turn: 60 } as const;
/** (the target stops at the joint's own limits, so a long press never winds it up past them) */
const LIMIT = { lift: LIFT, bend: BEND, wrist: WRIST, turn: TURN } as const;
const AXES: Record<string, [keyof typeof RATE, 1 | -1]> = {
  KeyR: ['lift', 1],
  KeyF: ['lift', -1],
  KeyT: ['bend', 1],
  KeyG: ['bend', -1],
  KeyU: ['wrist', 1],
  KeyJ: ['wrist', -1],
  KeyZ: ['turn', 1],
  KeyX: ['turn', -1],
};

const held = new Set<string>();
let listening = false;
let poke: (() => void) | null = null;

const active = () => armState.near && !armState.on && walkInput.inGame;
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Listen for the arm's keys (once per page); `invalidate` asks the scene for a frame (frameloop "demand"). */
export function listenArmKeys(invalidate: () => void): void {
  poke = invalidate;
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || !active()) return;
    if (e.code === 'KeyV' && !e.repeat) {
      armState.target = { ...armState.target, open: armState.target.open > 0.5 ? 0 : 1 };
      poke?.();
      return;
    }
    if (AXES[e.code]) {
      held.add(e.code);
      poke?.();
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
}

/** Move the arm's target for the keys held now. True while one is held (keep drawing). */
export function stepArmKeys(dt: number): boolean {
  if (!held.size) return false;
  if (!active()) {
    held.clear();
    return false;
  }
  const t = { ...armState.target };
  for (const code of held) {
    const [axis, sign] = AXES[code];
    t[axis] = Math.min(LIMIT[axis].max, Math.max(LIMIT[axis].min, (t[axis] ?? 0) + sign * RATE[axis] * dt));
  }
  armState.target = t;
  return true;
}
