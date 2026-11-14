import type { ThreeEvent } from '@react-three/fiber';
import { gesture } from '../anim';

/** A tap is pointerdown → pointerup moved less than 10 px; a longer move is a look-around drag, not an action. */
export const TAP_PX = 10;

export type TapHandler = (e: ThreeEvent<MouseEvent>) => void;

export function tapOnly(fn: () => void): TapHandler {
  return (e) => {
    if (Math.max(e.delta, gesture.moved) > TAP_PX) return;
    e.stopPropagation();
    fn();
  };
}
