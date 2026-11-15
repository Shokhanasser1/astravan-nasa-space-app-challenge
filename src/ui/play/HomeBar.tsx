import { useState, type ComponentType, type ReactNode } from 'react';
import { Battery, BatteryFull, BatteryLow, BatteryMedium, Heart, Leaf, Rocket, TriangleAlert, Wind, X, Zap } from 'lucide-react';
import type { View } from '../../state/game';
import { P } from '../../engine/rules';
import { Mark, type DataLabel } from './Holo';
import type { Tr } from './kit';
import './home-bar.css';

/**
 * The home story's top bar (docs/plans/2026-11-15-home-story.md step 2; the lead's document p. 13–14 "Ekranda: 4
 * resurs va sog'liq"): Air & water (a tank of airMax cells), Food (4 leaves), Power (today's batteries left of
 * total), Ship (repair %) and Health (5 hearts = crew ÷ 2, halves allowed). While planning, a small "→ n" shows
 * tonight for air and food (res.after, from the engine's preview). Tap a gauge: its name, value, data label and
 * one hint. Every number comes from View.res / View.batteries; nothing is computed here. Shown when
 * `features.homeStory` is on; ResourceBar stays for the flag off.
 */
type Res = NonNullable<View['res']>;
type Bat = View['batteries'];
type Key = 'air' | 'food' | 'power' | 'ship' | 'health';
type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>;

export interface HomeBarProps {
  res: Res;
  /** Today's batteries (plan phase only; View.batteries). Missing → the Power gauge shows a dash. */
  batteries?: Bat;
  tr: Tr;
}

interface Gauge {
  k: Key;
  icon: Icon;
  label: DataLabel;
  /** Text for the info card and screen readers, e.g. "5 / 8". */
  value: string;
  /** The warning state (amber + triangle): only for something that hurts soon. */
  warn: boolean;
  /** One hint line in the info card. */
  hint?: string;
  body: ReactNode;
}

const HEARTS = 5;
const batteryIcon = (b: NonNullable<Bat>): Icon =>
  b.left <= 0 ? Battery : b.left >= b.total ? BatteryFull : b.left * 2 >= b.total ? BatteryMedium : BatteryLow;

/** "→ n" for tonight; the slot is kept for the whole plan phase so the bar does not jump. */
function After({ k, now, after }: { k: Key; now: number; after?: number }) {
  if (after === undefined) return null;
  const same = after === now;
  return (
    <span className={`home-after${after < now ? ' worse' : ''}${same ? ' same' : ''}`} data-testid={`home-${k}-after`}>
      → {after}
    </span>
  );
}

/** Five hearts for health (crew 0–10, one heart = 2): full, half or empty; `tone` colours the filled part. */
export function HeartRow({ crew, size = 14 }: { crew: number; size?: number }) {
  const hearts = crew / 2;
  return (
    <span className="home-hearts" aria-hidden="true">
      {Array.from({ length: HEARTS }, (_, i) => {
        const fill = hearts >= i + 1 ? 'full' : hearts >= i + 0.5 ? 'half' : 'empty';
        return (
          <span key={i} className={`home-heart ${fill}`} data-fill={fill}>
            <Heart size={size} />
            <Heart size={size} className="home-heart-in" />
          </span>
        );
      })}
    </span>
  );
}

function gauges(res: Res, bat: Bat): Gauge[] {
  const hearts = res.crew / 2;
  const B = bat ? batteryIcon(bat) : Battery;
  // A drop is noticed (the lead's document pp. 6 and 12): while planning, the food takes the warning look when it falls
  // tonight (no light in the Greenhouse), the air when tonight's reserve is low (it runs out within a day).
  const airLow = res.after !== undefined && res.after.air <= P.crewUse;
  const foodFalls = res.after !== undefined && res.after.plant < res.plant;
  return [
    {
      k: 'air', icon: Wind, label: 'rule', value: `${res.air} / ${res.airMax}`, warn: res.air <= P.crewUse || airLow, hint: 'ui.res.air.how',
      body: (
        <>
          <span className="home-tank" aria-hidden="true">
            {Array.from({ length: res.airMax }, (_, i) => <i key={i} className={i < res.air ? 'on' : ''} />)}
          </span>
          <After k="air" now={res.air} after={res.after?.air} />
        </>
      ),
    },
    {
      k: 'food', icon: Leaf, label: 'rule', value: `${res.plant} / ${P.maxPlant}`, warn: (P.gardenResult[res.plant]?.crew ?? 0) < 0 || foodFalls, hint: 'ui.res.garden.how',
      body: (
        <>
          <span className="home-leaves" aria-hidden="true">
            {Array.from({ length: P.maxPlant }, (_, i) => <Leaf key={i} size={14} className={i < res.plant ? 'on' : ''} />)}
          </span>
          <After k="food" now={res.plant} after={res.after?.plant} />
        </>
      ),
    },
    {
      k: 'power', icon: Zap, label: 'rule', value: bat ? `${bat.left} / ${bat.total}` : '–', warn: false,
      body: (
        <span className="home-num" aria-hidden="true">
          <B size={18} className="home-tone" />
          {bat ? `${bat.left}/${bat.total}` : '–'}
        </span>
      ),
    },
    {
      k: 'ship', icon: Rocket, label: 'computed', value: `${res.ship}%`, warn: false, hint: 'ui.home.ship.hint',
      body: (
        <>
          <span className="home-ship" aria-hidden="true">
            <span className="home-ship-fill" style={{ width: `${res.ship}%` }} />
          </span>
          <span className="home-num" aria-hidden="true">{res.ship}%</span>
        </>
      ),
    },
    {
      k: 'health', icon: Heart, label: 'computed', value: `${hearts} / ${HEARTS}`, warn: hearts <= 1, hint: 'ui.res.crew.how',
      body: <HeartRow crew={res.crew} />,
    },
  ];
}

export function HomeBar({ res, batteries, tr }: HomeBarProps) {
  const [open, setOpen] = useState<Key | null>(null);
  const list = gauges(res, batteries);
  const g = open ? list.find((x) => x.k === open)! : null;
  const toggle = (k: Key) => setOpen((o) => (o === k ? null : k));
  return (
    <div className="hud-res pointer-events-none flex w-full flex-col items-center gap-2" data-testid="resources">
      <div className="home-bar res-bar glass pointer-events-auto rounded-[18px]" data-testid="home-bar">
        {list.map((x) => (
          <button
            key={x.k}
            type="button"
            data-testid={`home-${x.k}`}
            data-k={x.k}
            data-label={x.label}
            data-value={x.value}
            data-warn={x.warn || undefined}
            aria-expanded={open === x.k}
            title={x.k === 'ship' ? tr('ui.home.ship.hint') : undefined}
            className="res-cell home-cell"
            onClick={() => toggle(x.k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(x.k);
              }
            }}
          >
            <span className="home-head">
              <x.icon size={14} aria-hidden="true" className="home-tone shrink-0" />
              <span>{tr(`ui.home.${x.k}`)}</span>
              {x.warn && <TriangleAlert size={12} aria-hidden="true" className="home-warn shrink-0" data-testid={`home-${x.k}-warn`} />}
            </span>
            <span className="home-body">{x.body}</span>
            <span className="sr-only">{x.value}</span>
          </button>
        ))}
      </div>
      {g && (
        <div className="holo holo-in pointer-events-auto flex w-full max-w-sm flex-col gap-1 rounded-[18px] px-3 py-2 text-sm" data-testid="home-info" role="dialog" aria-label={tr(`ui.home.${g.k}`)}>
          <div className="flex items-center gap-2">
            <g.icon size={18} aria-hidden="true" className={g.warn ? 'text-alert' : 'text-measured'} />
            <span className="font-semibold">{tr(`ui.home.${g.k}`)}</span>
            <span className="tabular-nums">{g.value}</span>
            <Mark label={g.label} tr={tr} />
            <button type="button" className="abtn ml-auto !min-h-12 !min-w-12 !rounded-full !p-1.5" data-testid="home-info-close" aria-label={tr('ui.controls.close')} onClick={() => setOpen(null)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {g.hint && <p className="text-measured">{tr(g.hint)}</p>}
        </div>
      )}
    </div>
  );
}
