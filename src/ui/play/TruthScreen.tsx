import { ClipboardCheck, RotateCcw } from 'lucide-react';
import type { Dispatch } from 'react';
import type { Action, Truth } from '../../state/game';
import { Btn, Panel, type Tr } from './kit';
import { HomeTruth, Mark, SunTruth } from './Holo';
import { fmtRatio } from '../../quiz/quiz';

/**
 * Truth screen (lane D placeholder for G2; the 25-second sequence and the hourly curve come after G2).
 * The real week is revealed: dates, the measured level of each day, and what the player blocked.
 * Bars use a log scale (each level is ten times the one before), so a child reads the scale of tens.
 */
/** Fewer measured hours than this in a day → "partly measured" (.claude/rules/engine-data.md). */
const PARTLY_H = 18;

/** The datasets behind the week, most important first (CREDITS.md, NASA data table). */
const SOURCES = ['crater', 'donki', 'sdo', 'earth', 'sky', 'ground'] as const;

const barHeight = (ratio: number) => Math.max(4, Math.min(100, (Math.log10(Math.max(ratio, 1)) / 4) * 100 + 4));

export function TruthScreen({
  truth, dispatch, tr, onNext,
}: {
  truth: Truth;
  dispatch: Dispatch<Action>;
  tr: Tr;
  /** Set while the mission debrief (features.quiz) is still to pass: the button opens it instead of ending. */
  onNext?: () => void;
}) {
  const r = truth.result;
  // Days with fewer measured hours than PARTLY_H carry a "*" (rule: < 18 h measured → "partly measured").
  const partly = truth.days.filter((d) => d.hours < PARTLY_H).map((d) => d.day);
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
      {/* (Each bar stands in its own track of fixed height: a percentage height needs a parent with a height.) */}
      <div className="truth-chart" role="img" aria-label={tr('ui.truth.curve')} data-testid="truth-chart">
        {truth.days.map((d) => (
          <div key={d.day} className="truth-col">
            <span className="truth-val tabular-nums">
              {fmtRatio(d.ratio)}×{d.hours < PARTLY_H ? '*' : ''}
            </span>
            <span className="truth-track">
              <span className={`truth-bar ${d.level > 0 ? 'truth-bar-storm' : ''}`} style={{ height: `${barHeight(d.ratio)}%` }} />
            </span>
            <span className="truth-day">{d.day}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-measured">
        {tr('ui.truth.source')}
        <Mark label="measured" tr={tr} />
      </p>
      {partly.length > 0 && (
        <p className="-mt-2 text-center text-xs text-white/65" data-testid="truth-partly">
          * {tr('ui.truth.partly', { days: partly.join(', ') })}
        </p>
      )}
      <SunTruth weekId={truth.weekId} tr={tr} />
      <HomeTruth weekId={truth.weekId} tr={tr} />
      <div className="grid grid-cols-3 gap-2 text-center [&>div]:rounded-[16px] [&>div]:border [&>div]:border-[rgba(150,175,255,0.16)] [&>div]:bg-[rgba(150,175,255,0.08)] [&>div]:py-2">
        <div>
          <div className="text-xs text-white/70">{tr('ui.truth.crew')}</div>
          <div className="text-2xl font-bold tabular-nums" data-testid="truth-crew">
            {r.crew}
          </div>
          <Mark label="computed" tr={tr} />
        </div>
        <div>
          <div className="text-xs text-white/70">{tr('ui.truth.science')}</div>
          <div className="text-2xl font-bold tabular-nums" data-testid="truth-science">
            {r.science}
          </div>
          <Mark label="rule" tr={tr} />
        </div>
        <div>
          <div className="text-xs text-white/70">{tr('ui.truth.blocked')}</div>
          <div className="text-2xl font-bold tabular-nums">{Math.round(r.blockedPct)}%</div>
          <Mark label="computed" tr={tr} />
        </div>
      </div>
      <p className="text-center text-lg font-bold" data-testid="truth-title" data-title={r.title}>
        {tr(r.titleKey)}
      </p>
      {/* Where every real thing in this week came from (challenge: name the data sources inside the tool). */}
      <details className="rounded-[16px] border border-[rgba(150,175,255,0.16)] bg-[rgba(150,175,255,0.06)] px-3 py-2 text-sm" data-testid="truth-sources">
        <summary className="cursor-pointer select-none font-semibold">{tr('ui.truth.dataTitle')}</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-white/85">
          {SOURCES.map((k) => (
            <li key={k}>{tr(`ui.truth.data.${k}`)}</li>
          ))}
        </ul>
      </details>
      <p className="text-center text-xs text-white/60" data-testid="not-nasa">
        {tr('ui.truth.notNasa')}
      </p>
      <Btn data-testid="again" data-quiz={onNext ? 'pending' : undefined} className="primary big" onClick={onNext ?? (() => dispatch({ type: 'NEXT' }))}>
        {onNext ? <ClipboardCheck size={20} aria-hidden="true" /> : <RotateCcw size={20} aria-hidden="true" />}
        {tr(onNext ? 'quiz.ui.debriefOpen' : 'ui.end.again')}
      </Btn>
    </Panel>
  );
}
