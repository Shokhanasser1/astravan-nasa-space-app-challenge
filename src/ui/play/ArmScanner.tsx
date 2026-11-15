import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { invalidate } from '@react-three/fiber';
import { ArrowUp, Bot, CornerRightUp, Grab, Hand, RotateCw } from 'lucide-react';
import { armTargets, type Pt } from '../../arm/reach';
import { armState, armVersion, setArmOn, subscribeArm } from '../../arm/state';
import type { ScanFrame } from '../../arm/scan';
import { Btn, Panel, type Tr } from './kit';

type State = 'off' | 'camera' | 'models' | 'on' | 'denied' | 'error';
/** What the panel reads out each scan frame: the arm's shown angles, its grip, and a note key ('' = none). */
interface Readout {
  lift: number;
  bend: number;
  wrist: number;
  gripping: boolean;
  note: string;
}

/** The canvas draws with the interface's colour tokens (docs/DESIGN.md: no raw colours in a component). */
function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return { bg: v('--bg-1'), dim: v('--bg-0'), box: v('--mint'), fore: v('--peri'), hand: v('--text-2'), tip: v('--mint') };
}

const HAND_LINES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
] as const;

/**
 * The robot arm's hand scanner (features.robotArm): its button shows only while the astronaut stands near the arm
 * (src/scene/RobotArm.tsx), or K there. On: the camera scans the player's forearm and hand (src/arm/scan.ts) and the
 * arm follows (src/arm/reach.ts); the astronaut holds a remote. The panel shows the camera picture live and mirrored
 * with the scanned points over it: only a box round the hand and forearm is sharp, the rest is blurred so a face is
 * not shown (CLAUDE.md: no faces of children shown); nothing is kept or sent.
 */
export function ArmScanner({ tr }: { tr: Tr }) {
  useSyncExternalStore(subscribeArm, armVersion);
  const [state, setState] = useState<State>('off');
  const [read, setRead] = useState<Readout | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const last = useRef<{ hand: Pt[] | null; elbow: Pt | null; video: HTMLVideoElement } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const small = useRef<HTMLCanvasElement | null>(null);
  const shown = state !== 'off';

  const off = () => {
    stop.current?.();
    stop.current = null;
    last.current = null;
    setArmOn(false);
    setState('off');
    setRead(null);
    invalidate();
  };

  const onFrame = (f: ScanFrame) => {
    const t = armTargets(f.pose, f.hand, f.aspect);
    armState.target = {
      lift: t.lift ?? armState.target.lift,
      bend: t.bend ?? armState.target.bend,
      wrist: t.wrist ?? armState.target.wrist,
      open: t.open ?? armState.target.open,
    };
    last.current = { hand: f.hand, elbow: t.elbow, video: f.video };
    const s = armState.shown;
    setRead({
      lift: Math.round(s.lift),
      bend: Math.round(s.bend),
      wrist: Math.round(s.wrist),
      gripping: s.open <= 0.5,
      note: !f.hand ? 'ui.arm.noHand' : !t.elbow ? 'ui.arm.noElbow' : armState.held ? 'ui.arm.ground' : '',
    });
    invalidate();
  };

  const start = async () => {
    if (state === 'camera' || state === 'models') return;
    setState('camera');
    setArmOn(true);
    try {
      const { startScan } = await import('../../arm/scan');
      const s = await startScan(onFrame, (st) => setState(st === 'running' ? 'on' : st));
      if (!armState.on) s(); // closed while it was starting
      else stop.current = s;
    } catch (e) {
      setArmOn(false);
      setState((e as Error)?.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  };

  const toggle = () => (shown ? off() : void start());

  // K near the arm (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyK' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!armState.near && !shown) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // walking away from the arm turns the scanner off; leaving the screen stops the camera
  useEffect(() => {
    if (!armState.near && armState.on) off();
  });
  useEffect(() => () => off(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // the panel's picture, every animation frame while the panel is open
  useEffect(() => {
    if (!shown) return;
    let raf = 0;
    const c = tokens();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = canvas.current;
      const ctx = cv?.getContext('2d');
      if (!cv || !ctx) return;
      const W = cv.width;
      const H = cv.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);
      const l = last.current;
      const video = l?.video;
      if (!l || !video || video.readyState < 2 || !video.videoWidth) return;
      // the video cover-cropped to 4:3, mirrored like a mirror
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      let sw = vw;
      let sh = vh;
      if (vw / vh > W / H) sw = vh * (W / H);
      else sh = vw / (W / H);
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      const X = (p: Pt) => ((p.x * vw - sx) / sw) * W;
      const Y = (p: Pt) => ((p.y * vh - sy) / sh) * H;
      ctx.setTransform(-1, 0, 0, 1, W, 0);
      // everything blurred (a tiny copy scaled back up) and a little dark …
      if (!small.current) {
        small.current = document.createElement('canvas');
        small.current.width = 40;
        small.current.height = 30;
      }
      small.current.getContext('2d')?.drawImage(video, sx, sy, sw, sh, 0, 0, 40, 30);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small.current, 0, 0, W, H);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = c.dim;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      // … except the scanned hand and forearm, sharp in a box round their points
      const pts: Pt[] = [...(l.hand ?? []), ...(l.elbow ? [l.elbow] : [])];
      if (pts.length) {
        const pad = 18;
        const x0 = Math.max(0, Math.min(...pts.map(X)) - pad);
        const x1 = Math.min(W, Math.max(...pts.map(X)) + pad);
        const y0 = Math.max(0, Math.min(...pts.map(Y)) - pad);
        const y1 = Math.min(H, Math.max(...pts.map(Y)) + pad);
        if (x1 > x0 && y1 > y0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, y0, x1 - x0, y1 - y0);
          ctx.clip();
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
          ctx.restore();
          ctx.strokeStyle = c.box;
          ctx.lineWidth = 2;
          ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        }
      }
      const seg = (a: Pt, b: Pt, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(X(a), Y(a));
        ctx.lineTo(X(b), Y(b));
        ctx.stroke();
      };
      const dot = (p: Pt, r: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(X(p), Y(p), r, 0, Math.PI * 2);
        ctx.fill();
      };
      ctx.lineCap = 'round';
      if (l.elbow && l.hand) {
        seg(l.elbow, l.hand[0], c.fore, 7);
        dot(l.elbow, 6, c.fore);
      }
      if (l.hand) {
        for (const [a, b] of HAND_LINES) seg(l.hand[a], l.hand[b], c.hand, 2);
        for (const i of [4, 8, 12, 16, 20]) dot(l.hand[i], 4, c.tip);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [shown]);

  if (!armState.near && !shown) return null;
  const status =
    state === 'camera' ? 'ui.arm.camera' : state === 'models' ? 'ui.arm.loading' : state === 'denied' ? 'ui.arm.denied' : state === 'error' ? 'ui.arm.error' : '';

  const angle = (Icon: typeof ArrowUp, key: string, deg: number) => (
    <span className="inline-flex items-center gap-1" title={tr(key)} aria-label={`${tr(key)} ${deg}°`}>
      <Icon size={14} aria-hidden="true" className="text-[var(--peri)]" />
      {deg}°
    </span>
  );

  return (
    // (only the button and the panel take touches: the gap between them stays free for the walk stick)
    <div className="pointer-events-none flex flex-row-reverse items-start justify-between gap-2">
      {shown && (
        <Panel className="flex w-[208px] flex-col gap-2 text-xs [@media(max-height:500px)]:w-[168px]" data-testid="arm-scan-panel">
          <div className="text-sm font-bold text-[var(--text-1)]">{tr('ui.arm.title')}</div>
          <canvas ref={canvas} width={184} height={138} className="w-full rounded-[14px] [@media(max-height:700px)]:w-1/2" aria-hidden="true" />
          {/* the arm's three joints and its grip, as icons and numbers; or why it waits */}
          <div aria-live="polite" className="min-h-[1lh] text-[var(--text-2)]">
            {status ? (
              tr(status)
            ) : read ? (
              <div className="flex items-center justify-between font-semibold tabular-nums text-[var(--text-1)]">
                {angle(ArrowUp, 'ui.arm.lift', read.lift)}
                {angle(CornerRightUp, 'ui.arm.elbow', read.bend)}
                {angle(RotateCw, 'ui.arm.wrist', read.wrist)}
                <span title={tr('ui.arm.grip')} aria-label={tr(read.gripping ? 'ui.arm.closed' : 'ui.arm.open')}>
                  {read.gripping ? <Grab size={16} aria-hidden="true" className="text-[var(--mint)]" /> : <Hand size={16} aria-hidden="true" />}
                </span>
              </div>
            ) : null}
            {!status && read?.note ? <div className="mt-1">{tr(read.note)}</div> : null}
          </div>
          {/* (the three how-to lines only where there is room: phones keep the picture and the numbers) */}
          <ul className="flex flex-col gap-1 text-[var(--text-2)] [@media(max-height:700px)]:hidden">
            <li className="flex items-center gap-2">
              <ArrowUp size={14} aria-hidden="true" className="shrink-0" />
              {tr('ui.arm.helpLift')}
            </li>
            <li className="flex items-center gap-2">
              <RotateCw size={14} aria-hidden="true" className="shrink-0" />
              {tr('ui.arm.helpWrist')}
            </li>
            <li className="flex items-center gap-2">
              <Grab size={14} aria-hidden="true" className="shrink-0" />
              {tr('ui.arm.helpGrip')}
            </li>
          </ul>
          <div className="text-[var(--text-3)]">{tr('ui.arm.private')}</div>
        </Panel>
      )}
      <Btn
        type="button"
        data-testid="arm-scan-toggle"
        active={shown}
        className="pointer-events-auto !h-14 !w-14 shrink-0 !rounded-full !p-0"
        aria-label={tr(shown ? 'ui.arm.off' : 'ui.arm.on')}
        aria-pressed={shown}
        title={tr(shown ? 'ui.arm.off' : 'ui.arm.on')}
        onClick={toggle}
      >
        <Bot size={24} aria-hidden="true" />
      </Btn>
    </div>
  );
}
