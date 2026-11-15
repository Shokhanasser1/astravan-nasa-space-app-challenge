import { CalendarDays } from 'lucide-react';
import type { Board, View } from '../../state/game';
import type { Tr } from './kit';
import { Mark } from './Holo';

/**
 * Visor layer: day + radiation level, top centre (the gauges are ./ResourceBar.tsx, the radio line is the
 * mission-control hologram in ./Holo.tsx). Numbers come from the view and the engine selectors only.
 */
export function DayBadge({ view, board, tr }: { view: View; board: Board | null; tr: Tr }) {
  const known = board ? board.info.known : true;
  const level = board?.info.level ?? view.level;
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
        {known && view.ratio !== undefined && level > 0 ? ` · ${view.ratio}×` : ''}
      </span>
      {known && view.ratio !== undefined && level > 0 && <Mark label="measured" tr={tr} />}
    </div>
  );
}
