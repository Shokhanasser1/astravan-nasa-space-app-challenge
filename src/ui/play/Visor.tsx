import { CalendarDays } from 'lucide-react';
import type { Board, View } from '../../state/game';
import type { Tr } from './kit';
import { Mark } from './Holo';
import { fmtRatio } from '../../quiz/quiz';

/**
 * Visor layer: day + radiation level, top centre (the gauges are ./ResourceBar.tsx, the radio line is the
 * mission-control hologram in ./Holo.tsx). Numbers come from the view and the engine selectors only.
 */
export function DayBadge({ view, board, tr }: { view: View; board: Board | null; tr: Tr }) {
  // The board is the day being planned; while a day runs and at night the badge shows the day just played
  // (view.day), so its level and its ratio are the same day's — and tomorrow's level is never shown early.
  // An alert day stays "?" while it runs; at night its real level is known (toView).
  const planning = view.phase === 'morning' || view.phase === 'plan';
  const known = planning ? (board?.info.known ?? true) : !(view.alert && view.phase === 'run');
  const level = planning ? (board?.info.level ?? view.level) : view.level;
  return (
    <div className="glass hud-day pointer-events-none" data-testid="day-badge">
      <span className="hud-day-text">
        <CalendarDays size={16} aria-hidden="true" className="text-measured" />
        {tr('ui.hud.dayOf', { day: view.day, total: 7 })}
      </span>
      <span className="hud-day-pips" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={i + 1 < view.day ? 'hud-pip hud-pip-done' : i + 1 === view.day ? 'hud-pip hud-pip-now' : 'hud-pip'} />
        ))}
      </span>
      <span
        className={`hud-level ${known ? (level > 0 ? 'hud-level-alert' : '') : 'hud-level-alert'}`}
        data-level={known ? level : '?'}
      >
        {known ? `${level} · ${tr(`ui.level.${level}`)}` : `? · ${tr('ui.level.unknown')}`}
        {known && view.ratio !== undefined && level > 0 ? ` · ${fmtRatio(view.ratio)}×` : ''}
      </span>
      {known && view.ratio !== undefined && level > 0 && <Mark label="measured" tr={tr} />}
    </div>
  );
}
