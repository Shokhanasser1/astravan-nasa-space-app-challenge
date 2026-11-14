import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { invalidate } from '@react-three/fiber';
import { walkInput } from '../../walk/input';

/**
 * The touch stick of the free walk (handoff "first-person walk", section 4): push it the way you want to walk,
 * further for faster; looking around stays a drag anywhere on the scene. Touch screens only (W A S D and the arrows
 * do the same on a keyboard). No words on it.
 */
const SIZE = 112; // px, a thumb's reach
const REACH = SIZE / 2 - 22;

export function WalkStick() {
  const touch = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(hover: none) and (pointer: coarse)').matches, []);
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const end = () => {
    setKnob({ x: 0, y: 0 });
    walkInput.stick.x = 0;
    walkInput.stick.y = 0;
    invalidate();
  };
  // (Never leave the stick pushed when it goes away: a new phase, the end of the game.)
  useEffect(() => end, []);

  if (!touch) return null;

  const move = (e: ReactPointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(x, y);
    if (d > REACH) {
      x *= REACH / d;
      y *= REACH / d;
    }
    setKnob({ x, y });
    walkInput.stick.x = x / REACH;
    walkInput.stick.y = -y / REACH;
    invalidate();
  };

  return (
    <div
      ref={base}
      data-testid="walk-stick"
      aria-hidden="true"
      className="pointer-events-auto fixed left-4 top-[42%] grid touch-none select-none place-items-center rounded-full border border-white/30 bg-white/10"
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons || e.pointerType === 'touch') move(e);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <span className="block h-11 w-11 rounded-full bg-white/70" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
