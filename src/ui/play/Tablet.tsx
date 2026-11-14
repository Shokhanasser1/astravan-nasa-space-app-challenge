import { type ComponentType, type Dispatch } from "react";
import { BrickWall, ChevronDown, ClipboardList, FlaskConical, Radiation, Rocket, Sprout, Wind } from "lucide-react";
import type { LogLine, Machine as EngineMachine } from "../../engine/rules";
import type { Action, Board, Machine, Model, View } from "../../state/game";
import { Btn, Delta, Panel, type Tr } from "./kit";
import { Kbd } from "./Controls";

/**
 * The plan list (15 Nov: the wrist tablet left the default flow). It never opens by itself: a small "Plan list"
 * button opens it for players who prefer a list to walking with batteries. One row per machine: icon, name,
 * − count +, and a labelled effect from the engine's preview ("Air tonight 5 → 4"). The day card and the shelter
 * choice live in their own dialog (Decision.tsx). Also: the night's "What happened" card.
 */
type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" }>;

const ROWS: { k: Machine; e: EngineMachine; icon: Icon; tone: string }[] = [
  { k: "ls", e: "ls", icon: Wind, tone: "text-measured" },
  { k: "gh", e: "gh", icon: Sprout, tone: "text-good" },
  { k: "ws", e: "build", icon: BrickWall, tone: "text-rule" },
  { k: "sc", e: "sc", icon: FlaskConical, tone: "text-accent" },
  { k: "launch", e: "launch", icon: Rocket, tone: "text-sun" },
];

function effect(k: Machine, board: Board, model: Model, tr: Tr) {
  const g = model.game!;
  const p = board.preview;
  if (!p) return null;
  const label = (key: string) => <span className="opacity-80">{tr(key)} </span>;
  if (k === "ls") return <>{label("ui.plan.airTonight")}<Delta from={g.air} to={p.reserveAfter} /></>;
  if (k === "gh") return <>{label("ui.plan.gardenTonight")}<Delta from={g.plant} to={p.gardenAfter} /></>;
  if (k === "ws") return <>{label("ui.plan.wall")}<Delta from={g.wall} to={p.wallAfter} /></>;
  if (k === "sc") return <>{label("ui.plan.finds")}<span className="tabular-nums text-measured">+{p.sciToday}</span></>;
  return <>{label("ui.plan.launch")}<span className="tabular-nums">{board.alloc.launch} / 4</span></>;
}

export function PlanTablet({
  board,
  model,
  dispatch,
  tr,
  onFold,
}: {
  board: Board;
  model: Model;
  dispatch: Dispatch<Action>;
  tr: Tr;
  onFold: () => void;
}) {
  const warning = board.preview?.warning;
  const forced = board.info.forced;
  return (
    <Panel className="hud-tablet flex max-h-[46dvh] min-h-[7rem] !shrink flex-col gap-2 overflow-y-auto" data-testid="plan-tablet">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow flex items-center gap-2 !text-[#c2cbec]">
          <ClipboardList size={16} aria-hidden="true" />
          {tr("ui.plan.title")}
        </span>
        <Btn data-testid="tablet-fold" aria-label={tr("ui.controls.close")} onClick={onFold} className="min-h-10 py-1 text-sm">
          <ChevronDown size={18} aria-hidden="true" />
          <Kbd k="Tab" />
        </Btn>
      </div>
      {forced && <p className="text-sm text-alert">{tr("ui.board.forced")}</p>}
      <div className="flex flex-col gap-1.5" data-testid="machines">
        {ROWS.filter((r) => r.k !== "launch" || board.limits.max.launch > 0).map(({ k, e, icon: I, tone }) => {
          const count = board.alloc[e];
          const max = board.limits.max[e];
          const closed = max === 0;
          return (
            <div key={k} className={`grid grid-cols-[minmax(0,1fr)_auto_2rem_auto] items-center gap-x-2 ${closed ? "opacity-50" : ""}`} data-machine={k}>
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                  <I size={16} aria-hidden="true" className={`shrink-0 ${tone}`} />
                  <span className="break-words">{tr(`ui.machine.${k}`)}</span>
                </span>
                <span className="text-xs leading-tight">{closed ? tr("ui.plan.closed") : effect(k, board, model, tr)}</span>
              </span>
              <Btn
                data-testid={`machine-${k}-remove`}
                aria-label={`${tr(`ui.machine.${k}`)} −`}
                disabled={forced || count === 0}
                onClick={() => dispatch({ type: "SET", k, delta: -1 })}
              >
                −
              </Btn>
              <span className="text-center text-lg font-bold tabular-nums">{count}</span>
              <Btn
                data-testid={`machine-${k}-add`}
                aria-label={`${tr(`ui.machine.${k}`)} +`}
                disabled={forced || closed || count >= max}
                onClick={() => dispatch({ type: "SET", k })}
              >
                +
              </Btn>
            </div>
          );
        })}
      </div>
      {warning && (
        <p className="text-sm text-alert" data-testid="warning">
          {tr(warning)}
        </p>
      )}
    </Panel>
  );
}

/** A log line: the people-written sentence, or until it exists the key with its numbers. */
function lineText(line: LogLine, tr: Tr): string {
  const text = tr(line.key, line.vars);
  if (text !== line.key || !line.vars) return text;
  return `${line.key} ${Object.values(line.vars).join(" → ")}`;
}

type Res = NonNullable<View["res"]>;
const CHANGES: { k: string; icon: Icon; tone: string; v: (r: Res) => number; fmt?: (x: number) => string }[] = [
  { k: "air", icon: Wind, tone: "text-measured", v: (r) => r.air },
  { k: "garden", icon: Sprout, tone: "text-good", v: (r) => r.plant },
  { k: "wall", icon: BrickWall, tone: "text-rule", v: (r) => r.wall },
  { k: "sci", icon: FlaskConical, tone: "text-accent", v: (r) => r.sci },
  { k: "dose", icon: Radiation, tone: "text-computed", v: (r) => r.dose, fmt: (x) => x.toFixed(2) },
];

/** Night: what happened today — the engine's log (≤ 3 lines) and the gauges that moved (before → after). */
export function NightTablet({ model, before, after, tr }: { model: Model; before?: Res; after?: Res; tr: Tr }) {
  const log = (model.game?.log ?? []).slice(0, 3);
  const moved = before && after ? CHANGES.filter((c) => Math.abs(c.v(after) - c.v(before)) > 1e-9) : [];
  return (
    <Panel className="holo-in flex flex-col gap-1.5" data-testid="night-log">
      <span className="eyebrow !text-[#c2cbec]">{tr("ui.night.title")}</span>
      {log.length ? (
        log.map((l) => (
          <p key={l.key} className="text-base leading-snug">
            {lineText(l, tr)}
          </p>
        ))
      ) : (
        <p className="text-base">{tr("ui.night.quiet")}</p>
      )}
      {moved.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 text-sm" data-testid="night-changes">
          {moved.map(({ k, icon: I, tone, v, fmt }) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5" aria-label={tr(`ui.res.${k}.name`)}>
              <I size={14} aria-hidden="true" className={tone} />
              {fmt ? (
                <span className="tabular-nums">{fmt(v(before!))} → {fmt(v(after!))}</span>
              ) : (
                <Delta from={v(before!)} to={v(after!)} />
              )}
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}
