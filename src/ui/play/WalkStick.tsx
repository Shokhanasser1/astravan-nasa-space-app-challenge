import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { invalidate } from '@react-three/fiber';
import { walkInput } from '../../walk/input';
import { touchUi } from './Controls';

/**
 * The touch stick of the free walk (handoff "first-person walk", section 4): push it the way you want to walk,
 * further for faster; looking around stays a drag anywhere on the scene. Touch screens only (W A S D and the arrows
 * do the same on a keyboard). No words on it. Its place and size per device are CSS (`.hud-stick` in src/index.css:
 * 112 px on a phone, bigger on a tablet), so the reach is measured, not fixed.
 */
const KNOB = 0.4; // knob diameter, share of the stick

/** The astronaut's jump on a touch screen (Space on a keyboard): 0.44 m on the Moon, about six times the Earth jump. */
export function JumpButton() {
  if (!touchUi) return null;
  return (
    <button
      type="button"
      data-testid="jump"
      aria-label="Jump"
      className="hud-side pointer-events-auto grid h-16 w-16 touch-none select-none place-items-center rounded-full border-2 border-[#4fb3ff]/70 bg-[#4fb3ff]/10 text-2xl text-white/80"
      onPointerDown={(e) => {
        e.preventDefault();
        walkInput.jump = true;
        invalidate();
      }}
    >
      ⤒
    </button>
  );
}

export function WalkStick() {
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

  if (!touchUi) return null;

  const move = (e: ReactPointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const REACH = (r.width * (1 - KNOB)) / 2;
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
      className="hud-side hud-stick pointer-events-auto grid touch-none select-none place-items-center rounded-full border-2 border-[#4fb3ff]/70 bg-[#4fb3ff]/10"
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
      <span className="block rounded-full bg-white/70" style={{ width: `${KNOB * 100}%`, height: `${KNOB * 100}%`, transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
