import { useEffect, useRef, useState } from 'react';
import { invalidate } from '@react-three/fiber';
import { follow, palmStick, poseOf, readHand, type Pose, type Pt } from '../../hand/gestures';
import { walkInput } from '../../walk/input';
import { HoloPanel } from './Holo';
import type { Tr } from './kit';

/**
 * Hand control, an experiment (Shoxjahon aka, 15 Nov; plan: docs/specs/2026-11-14-hand-control-research.md):
 * ☝️ moves a glove cursor, 🤏 taps where it points (any button, any building), ✋ walks the astronaut, ✊ jumps.
 * On only with ?hands in the address and only after the child presses the button; the camera stops when it is
 * pressed again. The camera picture is never shown — only the hand's points, drawn as a small hologram.
 */
export const handsOn = typeof location !== 'undefined' && new URLSearchParams(location.search).has('hands');

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

/** Tap the element under (x, y) as a finger would: pointer down, pointer up, click (the scene listens to these). */
function tapAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  if (!el) return;
  const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 77, isPrimary: true, button: 0, pointerType: 'touch' };
  el.dispatchEvent(new PointerEvent('pointerdown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
  invalidate();
}

export function HandControl({ tr }: { tr: Tr }) {
  const [state, setState] = useState<'off' | 'loading' | 'on' | 'error'>('off');
  const [cursor, setCursor] = useState<{ x: number; y: number; pose: Pose } | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const s = useRef({ pose: 'none' as Pose, at: { x: 0.5, y: 0.5 } as Pt, t: 0 }).current;

  useEffect(() => () => stop.current?.(), []);

  const onHand = (points: Pt[] | null) => {
    const now = performance.now();
    const dt = s.t ? (now - s.t) / 1000 : 1 / 15;
    s.t = now;
    draw(points);
    if (!points) {
      if (s.pose === 'open') walkInput.stick.x = walkInput.stick.y = 0;
      s.pose = 'none';
      setCursor(null);
      return;
    }
    const h = readHand(points);
    const pose = poseOf(h, s.pose === 'pinch');
    s.at = follow(s.at, { x: h.x, y: h.y }, dt);
    const px = s.at.x * innerWidth;
    const py = s.at.y * innerHeight;
    if (pose === 'pinch' && s.pose !== 'pinch') tapAt(px, py);
    if (pose === 'fist' && s.pose !== 'fist') {
      walkInput.jump = true;
      invalidate();
    }
    if (pose === 'open') {
      const st = palmStick(h);
      walkInput.stick.x = st.x;
      walkInput.stick.y = st.y;
      invalidate();
    } else if (s.pose === 'open') {
      walkInput.stick.x = walkInput.stick.y = 0;
      invalidate();
    }
    s.pose = pose;
    setCursor({ x: px, y: py, pose });
  };

  const draw = (points: Pt[] | null) => {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 160, 120);
    if (!points) return;
    c.strokeStyle = 'rgba(127, 209, 255, 0.9)';
    c.fillStyle = 'rgba(227, 247, 255, 1)';
    c.lineWidth = 2;
    const X = (p: Pt) => (1 - p.x) * 160;
    const Y = (p: Pt) => p.y * 120;
    for (const [a, b] of BONES) {
      c.beginPath();
      c.moveTo(X(points[a]), Y(points[a]));
      c.lineTo(X(points[b]), Y(points[b]));
      c.stroke();
    }
    for (const p of points) c.fillRect(X(p) - 1.5, Y(p) - 1.5, 3, 3);
  };

  const toggle = async () => {
    if (state === 'loading') return;
    if (stop.current) {
      stop.current();
      stop.current = null;
      walkInput.stick.x = walkInput.stick.y = 0;
      setState('off');
      setCursor(null);
      return;
    }
    setState('loading');
    try {
      stop.current = await startHandsLazy(onHand);
      setState('on');
    } catch {
      setState('error');
    }
  };

  return (
    <>
      <div className="pointer-events-auto flex flex-col items-start gap-2">
        {state !== 'off' && (
          <HoloPanel className="flex flex-col gap-1 text-xs" data-testid="hand-panel">
            <canvas ref={canvas} width={160} height={120} className="rounded-lg" aria-hidden="true" />
            <span>{tr(state === 'loading' ? 'ui.hand.loading' : state === 'error' ? 'ui.hand.error' : 'ui.hand.help')}</span>
            <span className="opacity-70">{tr('ui.hand.private')}</span>
          </HoloPanel>
        )}
        <button
          type="button"
          data-testid="hand-toggle"
          className={`holo grid h-14 w-14 place-items-center rounded-full text-2xl ${state === 'on' ? 'ring-2 ring-measured' : ''}`}
          aria-label={tr(state === 'on' ? 'ui.hand.off' : 'ui.hand.on')}
          onClick={() => void toggle()}
        >
          ✋
        </button>
      </div>
      {cursor && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 text-3xl drop-shadow-[0_0_6px_rgba(127,209,255,0.9)]"
          style={{ left: cursor.x, top: cursor.y }}
          aria-hidden="true"
        >
          {cursor.pose === 'pinch' ? '🤏' : cursor.pose === 'open' ? '✋' : cursor.pose === 'fist' ? '✊' : '☝️'}
        </div>
      )}
    </>
  );
}

/** The tracker and MediaPipe load only now (a separate chunk; the first download stays small). */
async function startHandsLazy(onHand: (p: Pt[] | null) => void) {
  const { startHands } = await import('../../hand/tracker');
  return startHands(onHand);
}
