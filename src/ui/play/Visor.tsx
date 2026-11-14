import type { Board, Model, View } from '../../state/game';
import type { Tr } from './kit';

/**
 * Visor layer (lane D placeholder): day + level top centre, radio line, three gauges at the bottom.
 * Numbers come from the model and the engine selectors only.
 */
export function DayBadge({ view, board, tr }: { view: View; board: Board | null; tr: Tr }) {
  const known = board ? board.info.known : true;
  const level = board?.info.level ?? view.level;
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1 text-center" data-testid="day-badge">
      <span className="text-sm uppercase tracking-widest text-white/80">{tr('ui.hud.dayOf', { day: view.day, total: 7 })}</span>
      <span
        className={`rounded-full px-3 py-1 text-sm font-bold ${known ? (level > 0 ? 'bg-alert text-black' : 'bg-white/15') : 'bg-alert text-black'}`}
        data-level={known ? level : '?'}
      >
        {known ? `${level} · ${tr(`ui.level.${level}`)}` : `? · ${tr('ui.level.unknown')}`}
        {known && view.ratio !== undefined && level > 0 ? ` · ${view.ratio}×` : ''}
      </span>
    </div>
  );
}

/** Which radio line to play this morning. Choice of words only; no game number is computed here. */
export function radioKey(model: Model, board: Board | null): string | null {
  if (!board) return null;
  const { info } = board;
  const day = model.game?.day ?? 1;
  if (info.forced) return 'story.radio.emergency';
  if (info.storm === 'alert') return 'story.radio.alert';
  if (info.storm === 'storm') return 'story.radio.storm';
  if (info.watch) return 'story.radio.watch';
  if (day === 1) return 'story.radio.day1';
  if (day === 4) return 'story.radio.family';
  if (day === 7) return 'story.radio.launchDay';
  return 'story.radio.quiet';
}

export function RadioLine({ textKey, tr }: { textKey: string | null; tr: Tr }) {
  if (!textKey) return null;
  return (
    <p className="pointer-events-none mx-auto max-w-md rounded-xl bg-black/60 px-3 py-2 text-center text-base leading-snug" data-testid="radio">
      {tr(textKey)}
    </p>
  );
}

export function Gauges({ model, board, tr }: { model: Model; board: Board | null; tr: Tr }) {
  const g = model.game;
  if (!g) return null;
  const p = board?.preview;
  const total = board?.limits.available ?? 0;
  return (
    <div className="pointer-events-none grid grid-cols-3 gap-2 text-center text-sm" data-testid="gauges">
      <div className="rounded-xl bg-black/60 px-2 py-1">
        <div className="text-white/70">{tr('ui.gauge.energy')}</div>
        <div className="text-lg font-bold tabular-nums" data-testid="gauge-energy">
          {p ? `${p.left} / ${total}` : total || '—'}
        </div>
      </div>
      <div className="rounded-xl bg-black/60 px-2 py-1">
        <div className="text-white/70">{tr('ui.gauge.air')}</div>
        <div className="text-lg font-bold tabular-nums" data-testid="gauge-air">
          {g.air} / 8{p && p.reserveAfter !== g.air ? ` → ${p.reserveAfter}` : ''}
        </div>
      </div>
      <div className="rounded-xl bg-black/60 px-2 py-1">
        <div className="text-white/70">{tr('ui.gauge.dose')}</div>
        <div className="text-lg font-bold tabular-nums" data-testid="gauge-dose">
          {g.extra.toFixed(2)}
          {p && p.doseToday > 0 ? ` +${p.doseToday.toFixed(2)}` : ''}
        </div>
      </div>
    </div>
  );
}
