import { useState, type ComponentType } from 'react';
import { BrickWall, FlaskConical, Radiation, Sprout, Users, Wind, X } from 'lucide-react';
import type { View } from '../../state/game';
import { P } from '../../engine/rules';
import { Mark, type DataLabel } from './Holo';
import type { Tr } from './kit';

/**
 * The base at a glance (15 Nov, "make it a game"): crew, air and water, garden, wall, dose and science, always
 * visible at the top in one compact row. While a plan is on the board a small arrow shows tonight (res.after,
 * from the engine's preview). Tap a gauge: what it is, its label (measured / computed / game rule) and how to
 * raise it. Every number comes from View.res; nothing is computed here.
 */
type Res = NonNullable<View['res']>;
type Key = 'crew' | 'air' | 'garden' | 'wall' | 'dose' | 'sci';

interface Gauge {
  k: Key;
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>;
  tone: string;
  label: DataLabel;
  now: (r: Res) => string;
  max?: (r: Res) => number;
  /** Tonight, when it differs from now (plan phase only). */
  after?: (r: Res) => string | null;
  /** Tonight is worse than now: the arrow turns amber. */
  worse?: (r: Res) => boolean;
}

const fmt = (x: number) => x.toFixed(2);

const GAUGES: Gauge[] = [
  { k: 'crew', icon: Users, tone: 'text-sun', label: 'computed', now: (r) => String(r.crew), max: (r) => r.crewMax },
  {
    k: 'air', icon: Wind, tone: 'text-measured', label: 'rule', now: (r) => String(r.air), max: (r) => r.airMax,
    after: (r) => (r.after && r.after.air !== r.air ? String(r.after.air) : null),
    worse: (r) => !!r.after && r.after.air < r.air,
  },
  {
    k: 'garden', icon: Sprout, tone: 'text-good', label: 'rule', now: (r) => String(r.plant), max: () => 4,
    after: (r) => (r.after && r.after.plant !== r.plant ? String(r.after.plant) : null),
    worse: (r) => !!r.after && r.after.plant < r.plant,
  },
  {
    k: 'wall', icon: BrickWall, tone: 'text-rule', label: 'rule', now: (r) => String(r.wall), max: () => 3,
    after: (r) => (r.after && r.after.wall !== r.wall ? String(r.after.wall) : null),
  },
  {
    k: 'dose', icon: Radiation, tone: 'text-computed', label: 'computed', now: (r) => fmt(r.dose),
    after: (r) => (r.after && r.after.doseToday > 0 ? `+${fmt(r.after.doseToday)}` : null),
    worse: (r) => !!r.after && r.after.doseToday > 0,
  },
  {
    k: 'sci', icon: FlaskConical, tone: 'text-accent', label: 'rule', now: (r) => String(r.sci),
    after: (r) => (r.after && r.after.sciToday > 0 ? `+${r.after.sciToday}` : null),
  },
];

export function ResourceBar({ res, tr }: { res: Res; tr: Tr }) {
  const [open, setOpen] = useState<Key | null>(null);
  const g = open ? GAUGES.find((x) => x.k === open)! : null;
  return (
    <div className="hud-res pointer-events-none flex w-full flex-col items-center gap-2">
      <div className="res-bar glass pointer-events-auto flex max-w-full items-stretch rounded-[18px] px-1" data-testid="resources">
        {GAUGES.map((x) => {
          const after = x.after?.(res) ?? null;
          const Icon = x.icon;
          return (
            <button
              key={x.k}
              type="button"
              data-testid={`res-${x.k}`}
              aria-label={tr(`ui.res.${x.k}.name`)}
              aria-expanded={open === x.k}
              className={`res-cell flex flex-col items-center justify-center rounded-[14px] px-1.5 py-1 ${open === x.k ? 'bg-white/10' : ''}`}
              onPointerDown={() => setOpen((o) => (o === x.k ? null : x.k))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen((o) => (o === x.k ? null : x.k));
                }
              }}
            >
              <span className="flex items-center gap-1">
                <Icon size={16} aria-hidden="true" className={`shrink-0 ${x.tone}`} />
                <span className="text-base font-bold leading-none tabular-nums" data-value={x.now(res)}>
                  {x.now(res)}
                </span>
              </span>
              <span
                className={`h-4 text-[0.7rem] font-semibold leading-4 tabular-nums ${after ? (x.worse?.(res) ? 'text-alert' : 'text-measured') : 'opacity-0'}`}
                data-testid={`res-${x.k}-after`}
              >
                {after ? `→ ${after}` : '·'}
              </span>
            </button>
          );
        })}
      </div>
      {g && (
        <div className="holo holo-in pointer-events-auto flex w-full max-w-sm flex-col gap-1 rounded-[18px] px-3 py-2 text-sm" data-testid="res-info" role="dialog" aria-label={tr(`ui.res.${g.k}.name`)}>
          <div className="flex items-center gap-2">
            <g.icon size={18} aria-hidden="true" className={g.tone} />
            <span className="font-semibold">{tr(`ui.res.${g.k}.name`)}</span>
            <span className="tabular-nums">
              {g.now(res)}
              {g.max ? ` / ${g.max(res)}` : ''}
            </span>
            <Mark label={g.label} tr={tr} />
            <button type="button" className="abtn ml-auto !min-h-9 !rounded-full !p-1.5" aria-label={tr('ui.controls.close')} onClick={() => setOpen(null)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p>{tr(`ui.res.${g.k}.what`)}</p>
          <p className="text-measured">{tr(`ui.res.${g.k}.how`, { safe: P.doseSteps[0].toFixed(1) })}</p>
        </div>
      )}
    </div>
  );
}
