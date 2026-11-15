import type { ReactNode } from 'react';
import { BatteryFull, Battery, Hand, Undo2 } from 'lucide-react';
import { HANDS_MAX, STEP, atHub, reducer, type Action, type Board, type Machine, type Model } from '../../state/game';
import type { AimId } from '../../controls/bus';
import { Kbd } from './Controls';
import { features } from '../../config/features';
import type { Tr } from './kit';

/**
 * Carried batteries (15 Nov, "make it a game"): what is in the astronaut's hands, what is left at the power hub,
 * and what the button in front of the astronaut does right now. The effect of a battery ("air tonight 5 → 6")
 * comes from the reducer itself (a PUT tried on a copy of the model), never from arithmetic here.
 */
const KEY: Record<Machine, 'ls' | 'gh' | 'build' | 'sc' | 'launch'> = { ls: 'ls', gh: 'gh', ws: 'build', sc: 'sc', launch: 'launch' };

export interface Line {
  key: string;
  vars?: Record<string, string | number>;
}

export interface Context {
  /** What the astronaut can do here, in words. */
  prompt: Line;
  /** The result of the main action, when there is one. */
  fx?: Line;
  /** E / ✋: the main action (TAKE or PUT). */
  act: Action | null;
  /** Q / ↩: take back from this machine, or put everything back at the hub. */
  back: Action | null;
  /** Short label of the one touch button. */
  label: string;
}

function effect(model: Model, k: Machine): Line | 'blocked' {
  const after = reducer(model, { type: 'PUT', k });
  if (after === model || !after.preview || !model.preview) return 'blocked';
  const p0 = model.preview;
  const p1 = after.preview;
  switch (k) {
    case 'ls':
      return { key: 'ui.prompt.fx.ls', vars: { from: p0.reserveAfter, to: p1.reserveAfter } };
    case 'gh':
      return { key: 'ui.prompt.fx.gh', vars: { from: p0.gardenAfter, to: p1.gardenAfter } };
    case 'ws':
      return { key: 'ui.prompt.fx.ws', vars: { from: p0.wallAfter, to: p1.wallAfter } };
    case 'sc':
      return { key: 'ui.prompt.fx.sc', vars: { n: p1.sciToday } };
    case 'launch':
      return { key: 'ui.prompt.fx.launch' };
  }
}

/** What the context prompt and the one touch button offer, from the model and the aimed place. */
export function contextOf(model: Model, board: Board | null, aim: AimId | null): Context | null {
  if (model.phase !== 'plan' || !board || board.info.forced || !aim) return null;
  const hands = model.hands ?? 0;
  if (aim === 'hub') {
    const drop: Action | null = hands > 0 ? { type: 'DROP' } : null;
    if (hands >= HANDS_MAX) return { prompt: { key: 'ui.prompt.handsFull' }, act: null, back: drop, label: 'ui.act.drop' };
    if (atHub(model) < 1) return { prompt: { key: 'ui.prompt.hubEmpty' }, act: null, back: drop, label: 'ui.act.drop' };
    return { prompt: { key: 'ui.prompt.take' }, act: { type: 'TAKE' }, back: drop, label: 'ui.act.take' };
  }
  const k = aim;
  const name = `ui.machine.${k}`;
  const back: Action | null = board.alloc[KEY[k]] > 0 && !board.info.forced ? { type: 'BACK', k } : null;
  if (board.limits.max[KEY[k]] === 0) return { prompt: { key: 'ui.prompt.closed', vars: { name } }, act: null, back, label: 'ui.act.back' };
  if (hands < STEP[k]) {
    const need = STEP[k] > 1 ? { key: 'ui.prompt.needMany', vars: { n: STEP[k] } } : { key: 'ui.prompt.needOne' };
    return { prompt: need, act: null, back, label: 'ui.act.back' };
  }
  const fx = effect(model, k);
  if (fx === 'blocked') return { prompt: { key: 'ui.prompt.full', vars: { name } }, act: null, back, label: 'ui.act.back' };
  // (home story, the lead's document p. 5: every building has its own job — "Start the Air Maker", "Send the rover")
  if (features.homeStory) return { prompt: { key: `ui.verb.${k}` }, fx, act: { type: 'PUT', k }, back, label: `ui.verb.short.${k}` };
  return { prompt: { key: 'ui.prompt.put', vars: { name } }, fx, act: { type: 'PUT', k }, back, label: 'ui.act.put' };
}

/** Machine names inside a prompt are keys themselves: translate them before they go into the sentence. */
const say = (l: Line, tr: Tr) =>
  tr(l.key, Object.fromEntries(Object.entries(l.vars ?? {}).map(([n, v]) => [n, typeof v === 'string' && v.startsWith('ui.') ? tr(v) : v])));

/** Bottom-centre: what E / ✋ and Q do here. */
export function ContextPrompt({ ctx, tr }: { ctx: Context; tr: Tr }) {
  return (
    <div className="holo pointer-events-none mx-auto flex max-w-full flex-col items-center gap-0.5 rounded-[16px] px-3 py-1.5 text-center" data-testid="prompt">
      <p className="flex flex-wrap items-center justify-center gap-1 text-base font-semibold leading-snug">
        {ctx.act && (
          <>
            <Kbd k="E" />
            <Hand size={18} aria-hidden="true" className="text-accent" />
          </>
        )}
        <span>{say(ctx.prompt, tr)}</span>
        {ctx.fx && <span className="text-measured">— {say(ctx.fx, tr)}</span>}
      </p>
      {ctx.back && (
        <p className="flex items-center gap-1 text-sm opacity-85">
          <Kbd k="Q" />
          <Undo2 size={14} aria-hidden="true" />
          {tr(ctx.back.type === 'DROP' ? 'ui.prompt.drop' : 'ui.prompt.back')}
        </p>
      )}
    </div>
  );
}

/** Bottom-left: the batteries in the hands (up to four slots) and the ones still at the hub. */
export function Inventory({ hands, free, total, tr }: { hands: number; free: number; total: number; tr: Tr }) {
  return (
    <div className="hud-inv glass pointer-events-none flex flex-col gap-1 rounded-[18px] px-3 py-2" data-testid="inventory" data-hands={hands} data-hub={free}>
      <span className="text-xs font-semibold uppercase tracking-wide text-[#c2cbec]">{tr('ui.inv.hands')}</span>
      <span className="flex gap-1" aria-label={tr('ui.inv.handsN', { n: hands })}>
        {Array.from({ length: HANDS_MAX }, (_, i) =>
          i < hands ? (
            <BatteryFull key={i} size={24} aria-hidden="true" className="-rotate-90 text-[var(--c-power)]" />
          ) : (
            <Battery key={i} size={24} aria-hidden="true" className="-rotate-90 text-white/25" />
          ),
        )}
      </span>
      <span className="text-sm tabular-nums" data-testid="inv-hub">
        {tr('ui.inv.hub', { n: free, total })}
      </span>
    </div>
  );
}

/**
 * Touch: the one big action button (its label follows the prompt). It presses the same commands as E and Q, so it
 * goes through `resolve` (src/controls/act.ts) like the keys and the scene taps: E when there is a main action,
 * else Q (take back / put all back).
 */
export function ContextButton({ ctx, press, tr, children }: { ctx: Context | null; press: (kind: 'use' | 'undo') => void; tr: Tr; children?: ReactNode }) {
  const kind = ctx?.act ? 'use' : ctx?.back ? 'undo' : null;
  const label = ctx ? tr(ctx.act ? ctx.label : ctx.back?.type === 'DROP' ? 'ui.act.drop' : 'ui.act.back') : tr('ui.controls.use');
  return (
    <div className="hud-side hud-pad flex flex-col items-center gap-3" data-testid="action-pad">
      <button
        type="button"
        data-testid="pad-use"
        aria-label={label}
        disabled={!kind}
        onPointerDown={(e) => {
          // React on touch-down (kids press and slide off): the action fires once, at the press.
          e.preventDefault();
          if (kind) press(kind);
        }}
        className="pad-use abtn primary pointer-events-auto flex flex-col items-center justify-center !gap-0 !rounded-full !p-0 font-semibold leading-tight disabled:opacity-35"
      >
        {kind === 'undo' ? <Undo2 size={30} aria-hidden="true" /> : <Hand size={32} aria-hidden="true" />}
        <span className="max-w-full truncate px-1 text-xs">{label}</span>
      </button>
      {children}
    </div>
  );
}
