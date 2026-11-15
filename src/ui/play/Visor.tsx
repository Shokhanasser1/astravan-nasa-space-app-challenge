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
    <div className="glass pointer-events-none flex min-w-0 shrink flex-col items-center gap-1 rounded-[18px] px-2 py-1.5 text-center" data-testid="day-badge">
      <span className="flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-semibold uppercase leading-tight tracking-wide text-[#f3f6ff]">
        <CalendarDays size={16} aria-hidden="true" className="text-measured" />
        {tr('ui.hud.dayOf', { day: view.day, total: 7 })}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold leading-tight ${known ? (level > 0 ? 'bg-alert text-[#2a1b00]' : 'bg-white/15') : 'bg-alert text-[#2a1b00]'}`}
        data-level={known ? level : '?'}
      >
        {known ? `${level} · ${tr(`ui.level.${level}`)}` : `? · ${tr('ui.level.unknown')}`}
        {known && view.ratio !== undefined && level > 0 ? ` · ${view.ratio}×` : ''}
      </span>
      {known && view.ratio !== undefined && level > 0 && <Mark label="measured" tr={tr} />}
    </div>
  );
}
