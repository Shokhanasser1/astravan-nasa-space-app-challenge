import { useSyncExternalStore } from 'react';

/**
 * Title camera (entry spec, docs/specs/2026-11-15-entry.md): while the reception desk is on screen, the camera
 * drifts slowly around the base like a film's opening shot (the "living menu" of many games: the menu shows the
 * game itself). Scene-local, never part of the View. The HUD switches it on and off; the rig reads it.
 * Motion-sickness rules still hold: level horizon, no roll, a slow pendulum (≈ 1°/s), no shake; with
 * prefers-reduced-motion the camera stands still on the middle of the arc.
 */
let on = false;
const subs = new Set<() => void>();

export function setTitle(v: boolean): void {
  if (v === on) return;
  on = v;
  for (const f of subs) f();
}
export const titleOn = () => on;

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
/** React: is the title camera on (re-renders only when it changes). */
export function useTitle(): boolean {
  return useSyncExternalStore(subscribe, titleOn, titleOn);
}

/** The shot: around the middle of the base, high enough to see every building, the horizon level. */
export const TITLE = {
  /** What the camera looks at (metres). */
  target: [0.6, 1.2, -0.4] as const,
  radius: 13,
  height: 3.6,
  /** Middle of the arc, degrees, in the scene's azimuth convention (0 = +z, 90 = +x): the habitat in the middle,
   * the solar arrays and the lander on the right, the dish on the left (framed by hand, 15 Nov). */
  az: 120,
  /** Half the swing, degrees. */
  swing: 25,
  /** One full swing there and back, seconds. */
  period: 70,
} as const;

/** Camera place at time t (seconds) on the title arc; `still` = the middle of the arc. Pure. */
export function titlePose(t: number, still: boolean, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  // (dev only: window.__titleTune = { az, radius, height, swing } to frame the shot by hand)
  const tune = import.meta.env?.DEV && typeof window !== 'undefined' ? (window as unknown as { __titleTune?: Partial<typeof TITLE> }).__titleTune : undefined;
  const T = tune ? { ...TITLE, ...tune } : TITLE;
  const swing = still ? 0 : T.swing * Math.sin((2 * Math.PI * t) / T.period);
  const a = ((T.az + swing) * Math.PI) / 180;
  out.x = T.target[0] + Math.sin(a) * T.radius;
  out.z = T.target[2] + Math.cos(a) * T.radius;
  out.y = T.height;
  return out;
}

/**
 * Where the camera looks: at the target, then turned so the base sits clear of the menu — on a wide screen the menu
 * is on the left, so the base moves right (pan); on a tall screen the menu is a sheet at the bottom, so the base
 * moves up (tilt). Yaw/pitch in the rig's convention (rotation order YXZ, roll always 0). Pure.
 */
export function titleAngles(at: { x: number; y: number; z: number }, aspect: number): { yaw: number; pitch: number } {
  const dx = TITLE.target[0] - at.x;
  const dy = TITLE.target[1] - at.y;
  const dz = TITLE.target[2] - at.z;
  const wide = aspect > 1.25;
  const pan = wide ? (16 * Math.PI) / 180 : 0;
  const tilt = wide ? 0 : (-7 * Math.PI) / 180;
  return { yaw: Math.atan2(-dx, -dz) + pan, pitch: Math.atan2(dy, Math.hypot(dx, dz)) + tilt };
}
