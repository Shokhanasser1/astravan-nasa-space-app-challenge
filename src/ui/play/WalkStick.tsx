import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { invalidate } from '@react-three/fiber';
import { ArrowBigUpDash, Car, ChevronsDown, ChevronsUp, DoorOpen, Moon } from 'lucide-react';
import { walkInput } from '../../walk/input';
import { askRide, type Ride } from '../../controls/bus';
import { KeyHint, touchUi } from './Controls';
import type { Tr } from './kit';

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
      className="hud-round hud-jump pointer-events-auto"
      onPointerDown={(e) => {
        e.preventDefault();
        walkInput.jump = true;
        invalidate();
      }}
    >
      <ArrowBigUpDash size={28} aria-hidden="true" />
    </button>
  );
}

/**
 * `?drive` (local preview): beside the crew rover's hatch, climb in and drive; while driving, stop and climb out. E on
 * a keyboard (the badge shows it), a tap on a touch screen. Shown only when it would do something.
 */
/** Its words: ui.ride.<ride> (board, exit, enter, leave, up, down, sleep). */
const rideLabel = (ride: Ride, tr: Tr) => tr(`ui.ride.${ride}`);

/**
 * Touch: the round rover / door / ladder key above the right thumb. `onSleep` (home story): at the habitat door once
 * the day has run, the button is Sleep — the HUD's NEXT, not the rig's.
 */
export function RideButton({ ride, tr, onSleep }: { ride: Ride | null; tr: Tr; onSleep?: () => void }) {
  if (!ride || !touchUi) return null;
  return (
    <button
      type="button"
      data-testid="ride"
      aria-label={rideLabel(ride, tr)}
      className="hud-side hud-round hud-ride pointer-events-auto"
      onPointerDown={(e) => {
        e.preventDefault();
        if (ride === 'sleep') onSleep?.();
        else askRide();
        invalidate();
      }}
    >
      {ride === 'board' ? (
        <Car size={30} aria-hidden="true" />
      ) : ride === 'sleep' ? (
        <Moon size={30} aria-hidden="true" />
      ) : ride === 'up' ? (
        <ChevronsUp size={30} aria-hidden="true" />
      ) : ride === 'down' ? (
        <ChevronsDown size={30} aria-hidden="true" />
      ) : (
        <DoorOpen size={30} aria-hidden="true" />
      )}
    </button>
  );
}

/** Keyboard: "E  Go inside" as a hint in the prompt place (no round button on a laptop). */
export function RideHint({ ride, tr }: { ride: Ride | null; tr: Tr }) {
  if (!ride || touchUi) return null;
  return (
    <div className="flex justify-center">
      <KeyHint
        data-testid="ride"
        k="E"
        label={rideLabel(ride, tr)}
        onClick={() => {
          askRide();
          invalidate();
        }}
      />
    </div>
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
      className="hud-side hud-stick pointer-events-auto grid touch-none select-none place-items-center"
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
      <span className="hud-knob block" style={{ width: `${KNOB * 100}%`, height: `${KNOB * 100}%`, transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
