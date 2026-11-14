import { CalendarDays, Radiation, Wind, Zap } from 'lucide-react';
import type { Board, Model, View } from '../../state/game';
import type { Tr } from './kit';
import { Mark } from './Holo';

/**
 * Visor layer (lane D placeholder): day + level top centre, three gauges at the bottom (the radio line is the
 * mission-control hologram in ./Holo.tsx).
 * Numbers come from the model and the engine selectors only.
 */
export function DayBadge({ view, board, tr }: { view: View; board: Board | null; tr: Tr }) {
  const known = board ? board.info.known : true;
  const level = board?.info.level ?? view.level;
  return (
    <div className="glass pointer-events-none flex flex-col items-center gap-1 rounded-[18px] px-4 py-2 text-center" data-testid="day-badge">
      <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#f3f6ff]">
        <CalendarDays size={16} aria-hidden="true" className="text-measured" />
        {tr('ui.hud.dayOf', { day: view.day, total: 7 })}
      </span>
      <span
        className={`rounded-full px-3 py-1 text-sm font-bold ${known ? (level > 0 ? 'bg-alert text-[#2a1b00]' : 'bg-white/15') : 'bg-alert text-[#2a1b00]'}`}
        data-level={known ? level : '?'}
      >
        {known ? `${level} · ${tr(`ui.level.${level}`)}` : `? · ${tr('ui.level.unknown')}`}
        {known && view.ratio !== undefined && level > 0 ? ` · ${view.ratio}×` : ''}
      </span>
      {known && view.ratio !== undefined && level > 0 && <Mark label="measured" tr={tr} />}
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

export function Gauges({ model, board, tr }: { model: Model; board: Board | null; tr: Tr }) {
  const g = model.game;
  if (!g) return null;
  const p = board?.preview;
  const total = board?.limits.available ?? 0;
  const cell = 'glass flex flex-col gap-0.5 rounded-[18px] px-2 py-1.5';
  const label = 'flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-[#c2cbec]';
  return (
    <div className="pointer-events-none grid grid-cols-3 gap-2 text-center text-sm" data-testid="gauges">
      <div className={cell}>
        <div className={label}>
          <Zap size={16} aria-hidden="true" className="shrink-0 text-[#ffc94a]" />
          {tr('ui.gauge.energy')}
          <Mark label="rule" tr={tr} />
        </div>
        <div className="text-lg font-bold tabular-nums" data-testid="gauge-energy">
          {p ? `${p.left} / ${total}` : total || '—'}
        </div>
      </div>
      <div className={cell}>
        <div className={label}>
          <Wind size={16} aria-hidden="true" className="shrink-0 text-measured" />
          {tr('ui.gauge.air')}
          <Mark label="rule" tr={tr} />
        </div>
        <div className="text-lg font-bold tabular-nums" data-testid="gauge-air">
          {g.air} / 8{p && p.reserveAfter !== g.air ? ` → ${p.reserveAfter}` : ''}
        </div>
      </div>
      <div className={cell}>
        <div className={label}>
          <Radiation size={16} aria-hidden="true" className="shrink-0 text-computed" />
          {tr('ui.gauge.dose')}
          <Mark label="computed" tr={tr} />
        </div>
        <div className="text-lg font-bold tabular-nums" data-testid="gauge-dose">
          {g.extra.toFixed(2)}
          {p && p.doseToday > 0 ? ` +${p.doseToday.toFixed(2)}` : ''}
        </div>
      </div>
    </div>
  );
}
