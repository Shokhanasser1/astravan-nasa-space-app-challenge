import { RotateCcw } from 'lucide-react';
import type { Dispatch } from 'react';
import type { Action, Truth } from '../../state/game';
import { Btn, Panel, type Tr } from './kit';
import { HomeTruth, Mark, SunTruth } from './Holo';

/**
 * Truth screen (lane D placeholder for G2; the 25-second sequence and the hourly curve come after G2).
 * The real week is revealed: dates, the measured level of each day, and what the player blocked.
 * Bars use a log scale (each level is ten times the one before), so a child reads the scale of tens.
 */
const barHeight = (ratio: number) => Math.max(4, Math.min(100, (Math.log10(Math.max(ratio, 1)) / 4) * 100 + 4));

export function TruthScreen({ truth, dispatch, tr }: { truth: Truth; dispatch: Dispatch<Action>; tr: Tr }) {
  const r = truth.result;
  const first = truth.days[0]?.date;
  const last = truth.days[truth.days.length - 1]?.date;
  return (
    <Panel
      // The reveal is taller than a small phone (360×640): the panel scrolls by touch inside the fixed HUD.
      className="mx-auto flex min-h-0 max-h-full w-full max-w-lg touch-pan-y flex-col gap-3 overflow-y-auto overscroll-contain"
      data-testid="truth"
    >
      <h1 className="title-grad text-center text-2xl font-bold">{tr('ui.truth.real')}</h1>
      <p className="text-center text-lg tabular-nums" data-testid="truth-dates">
        {first} — {last}
      </p>
      <div className="flex h-32 items-end justify-between gap-1" aria-label={tr('ui.truth.curve')}>
        {truth.days.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs tabular-nums">{d.ratio}×</span>
            <div className={`w-full rounded-t ${d.level > 0 ? 'bg-[#ff8a3d]' : 'bg-[#8b96c0]/60'}`} style={{ height: `${barHeight(d.ratio)}%` }} />
            <span className="text-xs">{d.day}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-measured">
        {tr('ui.truth.source')}
        <Mark label="measured" tr={tr} />
      </p>
      <SunTruth weekId={truth.weekId} tr={tr} />
      <HomeTruth weekId={truth.weekId} tr={tr} />
      <div className="grid grid-cols-3 gap-2 text-center [&>div]:rounded-[16px] [&>div]:border [&>div]:border-[rgba(150,175,255,0.16)] [&>div]:bg-[rgba(150,175,255,0.08)] [&>div]:py-2">
        <div>
          <div className="text-xs text-white/70">{tr('ui.truth.crew')}</div>
          <div className="text-2xl font-bold tabular-nums" data-testid="truth-crew">
            {r.crew}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/70">{tr('ui.truth.science')}</div>
          <div className="text-2xl font-bold tabular-nums" data-testid="truth-science">
            {r.science}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/70">{tr('ui.truth.blocked')}</div>
          <div className="text-2xl font-bold tabular-nums">{Math.round(r.blockedPct)}%</div>
        </div>
      </div>
      <p className="text-center text-lg font-bold" data-testid="truth-title" data-title={r.title}>
        {tr(r.titleKey)}
      </p>
      <Btn data-testid="again" className="primary big" onClick={() => dispatch({ type: 'NEXT' })}>
        <RotateCcw size={20} aria-hidden="true" />
        {tr('ui.end.again')}
      </Btn>
    </Panel>
  );
}
