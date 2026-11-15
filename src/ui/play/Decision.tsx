import { type ComponentType, type Dispatch, type ReactNode } from 'react';
import {
  BatteryFull, Flame, FlaskConical, Footprints, Headphones, House, HousePlus, Pickaxe, Radiation, Shield, Snowflake,
  Sparkles, Sprout, Sun, Wind, X,
} from 'lucide-react';
import type { Action, Board, Model } from '../../state/game';
import type { Shelter } from '../../engine/rules';
import { Btn, Delta, Panel, type Tr } from './kit';
import { Kbd } from './Controls';

/**
 * The day's decision as its own simple dialog (15 Nov, "make it a game"): it opens only when a decision is
 * pending — the day card and / or the shelter choice — with 2–3 big choice cards: an icon, a short title and one
 * line of consequence from that choice's own engine preview (price before choice). The HUD closes it once
 * nothing else is pending (Hud.tsx `act`, so a number key closes it too).
 */
type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>;

const PICK_ICON: Record<string, Icon> = {
  heat: Flame, cool: Snowflake, go: Footprints, skip: X, brush: Sun, leave: X, swap: Sparkles, wait: X,
  rest: House, push: Footprints,
};
const SHELTER_ICON: Record<Shelter, Icon> = { full: House, half: HousePlus, none: Pickaxe };

function Chip({ icon: I, tone, children }: { icon: Icon; tone: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <I size={14} aria-hidden="true" className={tone} />
      {children}
    </span>
  );
}

export function Decision({
  board, model, dispatch, tr, hint, onHint, onClose, shelterPicked,
}: {
  /** The shelter was chosen today (until then no button looks pressed: 'none' is only the default). */
  shelterPicked: boolean;
  board: Board;
  model: Model;
  dispatch: Dispatch<Action>;
  tr: Tr;
  hint: boolean;
  onHint: () => void;
  onClose: () => void;
}) {
  const g = model.game!;
  const card = board.info.card;
  const known = board.info.known;
  return (
    <div className="decision-wrap pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-[#050816]/55 p-4">
      <Panel className="holo-in flex max-h-[88dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto" data-testid="decision" role="dialog" aria-modal="true" aria-label={tr('ui.decide.title')}>
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow !text-[#c2cbec]">{tr('ui.decide.title')}</span>
          <Btn data-testid="decision-close" aria-label={tr('ui.controls.close')} onClick={onClose} className="min-h-10 py-1">
            <X size={18} aria-hidden="true" />
          </Btn>
        </div>

        {card && board.cardOptions.length > 0 && (
          <div className="flex flex-col gap-2" data-testid="card">
            <p className="text-lg font-semibold leading-snug">{tr(`story.card.${card}.text`)}</p>
            <div className="grid grid-cols-2 gap-2">
              {board.cardOptions.map(({ value, preview: p }, i) => {
                const pick = value.split(':')[1] ?? '';
                const I = PICK_ICON[pick] ?? Sparkles;
                return (
                  <button
                    type="button"
                    key={value}
                    data-testid={`card-${value.replace(':', '-')}`}
                    className={`abtn choice flex flex-col items-start gap-1 text-left ${board.cardChoice === value ? 'on' : ''}`}
                    onClick={() => dispatch({ type: 'CHOOSE', card: value })}
                  >
                    <span className="flex items-center gap-2 text-base font-bold">
                      <I size={26} aria-hidden="true" />
                      {tr(`story.card.${value.replace(':', '.')}`)}
                      <Kbd k={String(i + 1)} />
                    </span>
                    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-normal">
                      <Chip icon={BatteryFull} tone="text-[#ffc94a]">{tr('ui.decide.left', { n: p.left })}</Chip>
                      <Chip icon={Wind} tone="text-measured"><Delta from={g.air} to={p.reserveAfter} /></Chip>
                      <Chip icon={Sprout} tone="text-good"><Delta from={g.plant} to={p.gardenAfter} /></Chip>
                      {p.sciToday > 0 && <Chip icon={FlaskConical} tone="text-accent">+{p.sciToday}</Chip>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {board.shelterOptions.length > 0 && (
          <div className="flex flex-col gap-2" data-testid="shelter">
            <p className="text-lg font-semibold leading-snug">{tr(board.info.storm === 'alert' ? 'ui.decide.alert' : 'ui.decide.storm')}</p>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
              {board.shelterOptions.map(({ value, preview: p }, i) => {
                const I = SHELTER_ICON[value];
                return (
                  <button
                    type="button"
                    key={value}
                    data-testid={`shelter-${value}`}
                    className={`abtn choice flex flex-row items-center gap-2 text-left min-[420px]:flex-col min-[420px]:items-start ${shelterPicked && board.alloc.shelter === value ? 'on' : ''}`}
                    onClick={() => dispatch({ type: 'CHOOSE', shelter: value })}
                  >
                    <I size={28} aria-hidden="true" className="shrink-0" />
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center text-base font-bold">
                        {tr(`ui.shelter.${value}`)}
                        <Kbd k={String(board.cardOptions.length + i + 1)} />
                      </span>
                      <span className="text-xs font-normal">{tr(`ui.shelter.${value}Cost`)}</span>
                      {known && (
                        <span className="flex flex-wrap gap-x-2 text-xs font-normal tabular-nums">
                          <Chip icon={Shield} tone="text-measured">{tr('ui.decide.blocks', { pct: Math.round(p.blockedToday * 100) })}</Chip>
                          <Chip icon={Radiation} tone="text-computed">+{p.doseToday.toFixed(2)}</Chip>
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <Btn data-testid="ask-houston" onClick={onHint} active={hint} className="self-start text-sm">
              <Headphones size={18} aria-hidden="true" />
              {tr('ui.shelter.askHouston')}
              <Kbd k="H" />
            </Btn>
            {hint && <p className="text-sm text-white/85">{tr(board.info.storm === 'alert' ? 'story.houston.alert' : 'story.houston.storm')}</p>}
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Is a decision still waiting today? (The card needs an answer; the shelter, once per day.) */
export function pendingDecision(board: Board | null, shelterPicked: boolean): boolean {
  if (!board) return false;
  const card = !!board.info.card && board.cardOptions.length > 0 && !board.cardChoice;
  const shelter = board.shelterOptions.length > 0 && !shelterPicked;
  return card || shelter;
}
