import { useEffect, useRef, type Dispatch, type ReactNode } from 'react';
import {
  ArrowUpToLine,
  Footprints,
  Gamepad2,
  Hand,
  Headphones,
  HelpCircle,
  Map as MapIcon,
  Move,
  Pointer,
  RectangleHorizontal,
  Tablet as TabletIcon,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Action, Board, Machine } from '../../state/game';
import { command } from '../../controls/keys';
import { TRAVEL, resolve, type Ctx, type Effect, type Overlay, type UiOp } from '../../controls/act';
import { travel } from '../../controls/bus';
import { freeWalk } from '../../walk/enabled';
import { Btn, Panel, type Tr } from './kit';

/**
 * Controls layer (docs/specs/2026-11-14-controls-guide.html, features.controls): game keys on a laptop, the action
 * buttons on a phone or tablet, the base map and the list of controls. Every control ends in an existing action
 * (SET, CHOOSE, CONFIRM, NEXT) or opens a window; the rules are in src/controls/act.ts and are tested there.
 */

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const media = (q: string) => typeof matchMedia !== 'undefined' && matchMedia(q).matches;
/** Touch screen (phone, tablet): action buttons and the walk stick. `?touch` shows them on a laptop for testing. */
export const touchUi = params.has('touch') || media('(hover: none) and (pointer: coarse)');
/** Mouse and keyboard: small key badges next to the buttons they press. */
export const keyHints = !touchUi;

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Listens for the game keys; `ctx` is read fresh on every key press. */
export function useGameKeys(ctx: Ctx, apply: (e: Effect) => void) {
  const ref = useRef({ ctx, apply });
  ref.current = { ctx, apply };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || typing(e.target)) return;
      const cmd = command(e);
      if (!cmd) return;
      const effect = resolve(cmd, ref.current.ctx);
      // F1 must not open the browser's help. (Tab keeps moving the focus between buttons whenever it has no game
      // job, so the HUD stays usable with the keyboard alone.)
      if (cmd.kind === 'help') e.preventDefault();
      if (!effect) return;
      // (Enter on a focused button would press it a second time; Tab would also move the focus.)
      e.preventDefault();
      ref.current.apply(effect);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);
}

/** A key name next to a button, only with a mouse and keyboard. */
export function Kbd({ k }: { k: string }) {
  if (!keyHints) return null;
  return (
    <kbd className="kbd ml-1">
      {k}
    </kbd>
  );
}

/** Top-left: the base map (in the game) and the list of controls (always). */
export function CornerButtons({ map, open, tr }: { map: boolean; open: (o: UiOp) => void; tr: Tr }) {
  return (
    <div className="hud-corner pointer-events-auto flex gap-2">
      {map && (
        <Btn data-testid="open-map" aria-label={tr('ui.controls.map')} onClick={() => open('map')} className="text-xl">
          <MapIcon size={22} aria-hidden="true" />
        </Btn>
      )}
      <Btn data-testid="open-help" aria-label={tr('ui.controls.help')} onClick={() => open('help')} className="text-xl">
        <HelpCircle size={22} aria-hidden="true" />
      </Btn>
    </div>
  );
}

/** The base map: the six standing points and inside the habitat, numbered like their keys. */
export function MapPanel({ apply, tr }: { apply: (e: Effect) => void; tr: Tr }) {
  return (
    <Panel className="mx-auto flex w-full max-w-sm flex-col gap-2" data-testid="map" role="dialog" aria-label={tr('ui.controls.map')}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow flex items-center gap-2 !text-[#c2cbec]">
          <MapIcon size={16} aria-hidden="true" />
          {tr('ui.controls.map')}
        </span>
        <Btn data-testid="close-panel" aria-label={tr('ui.controls.close')} onClick={() => apply({ ui: 'close' })}>
          <X size={18} aria-hidden="true" />
          <Kbd k="Esc" />
        </Btn>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {TRAVEL.map((p, i) => (
          <Btn key={p} data-testid={`travel-${p}`} onClick={() => apply({ travel: p })} className="flex items-center gap-2 text-left">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] font-semibold text-[var(--accent-ink)] text-sm tabular-nums">{i + 1}</span>
            <span className="text-sm">{tr(`ui.point.${p}`)}</span>
          </Btn>
        ))}
      </div>
    </Panel>
  );
}

/** One row of the controls list: the keys, the touch way, what it does. */
/** (The touch column uses the same line icons as the buttons themselves: Lucide, 2 px stroke, no emoji.) */
const HELP: { keys: string[]; touch: LucideIcon; text: string; walk?: boolean }[] = [
  { keys: ['W', 'A', 'S', 'D'], touch: Gamepad2, text: 'ui.help.walk', walk: true },
  { keys: ['←', '→'], touch: Gamepad2, text: 'ui.help.turn', walk: true },
  { keys: ['Shift'], touch: Footprints, text: 'ui.help.run', walk: true },
  { keys: ['Space'], touch: ArrowUpToLine, text: 'ui.help.jump', walk: true },
  { keys: ['Mouse'], touch: Move, text: 'ui.help.look' },
  { keys: ['E', 'Click'], touch: Hand, text: 'ui.help.use' },
  { keys: ['Q'], touch: Undo2, text: 'ui.help.undo' },
  { keys: ['1', '2', '3'], touch: Pointer, text: 'ui.help.pick' },
  { keys: ['Enter'], touch: RectangleHorizontal, text: 'ui.help.confirm' },
  { keys: ['Tab'], touch: TabletIcon, text: 'ui.help.tablet' },
  { keys: ['H'], touch: Headphones, text: 'ui.help.houston' },
  { keys: ['M'], touch: MapIcon, text: 'ui.help.map' },
  { keys: ['Esc'], touch: X, text: 'ui.help.close' },
  { keys: ['?'], touch: HelpCircle, text: 'ui.help.help' },
];

export function HelpPanel({ apply, tr }: { apply: (e: Effect) => void; tr: Tr }) {
  const rows = HELP.filter((r) => freeWalk || !r.walk);
  return (
    <Panel className="mx-auto flex max-h-[80dvh] w-full max-w-md flex-col gap-2 overflow-y-auto" data-testid="help" role="dialog" aria-label={tr('ui.controls.help')}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow !text-[#c2cbec]">{tr('ui.controls.help')}</span>
        <Btn data-testid="close-panel" aria-label={tr('ui.controls.close')} onClick={() => apply({ ui: 'close' })}>
          <X size={18} aria-hidden="true" />
          <Kbd k="Esc" />
        </Btn>
      </div>
      {rows.map((r) => (
        <div key={r.text} className="grid grid-cols-[minmax(5.5rem,auto)_2rem_1fr] items-center gap-2 text-sm">
          <span className="flex flex-wrap gap-1">
            {r.keys.map((k) => (
              <kbd key={k} className="kbd">
                {k}
              </kbd>
            ))}
          </span>
          <span className="grid place-items-center text-[var(--accent)]" aria-hidden="true">
            <r.touch size={18} />
          </span>
          <span>{tr(r.text)}</span>
        </div>
      ))}
    </Panel>
  );
}

/** Applies an effect from a key or a button: game actions go to the reducer, the rest open or close windows. */
export function makeApply(
  dispatch: Dispatch<Action>,
  ui: { setOverlay: (f: (o: Overlay) => Overlay) => void; toggleTablet: () => void; toggleHouston: () => void },
) {
  return (e: Effect) => {
    if ('action' in e) return dispatch(e.action);
    if ('travel' in e) {
      travel(e.travel);
      return ui.setOverlay(() => null);
    }
    switch (e.ui) {
      case 'tablet':
        return ui.toggleTablet();
      case 'houston':
        return ui.toggleHouston();
      case 'close':
        return ui.setOverlay(() => null);
      case 'map':
      case 'help': {
        const want = e.ui;
        return ui.setOverlay((o) => (o === want ? null : want));
      }
    }
  };
}
