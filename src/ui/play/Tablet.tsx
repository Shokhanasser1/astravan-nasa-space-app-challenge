import { type Dispatch } from "react";
import type { LogLine, Machine as EngineMachine } from "../../engine/rules";
import type { Action, Board, Machine, Model } from "../../state/game";
import { Btn, Delta, Panel, type Tr } from "./kit";
import { Kbd } from "./Controls";
import { features } from "../../config/features";

/**
 * Wrist tablet (lane D placeholder): the day card with its prices, the shelter choice, the energy board and the
 * night log. Every price comes from `board.*.preview` (engine), shown before the button is pressed.
 */
const ROWS: { k: Machine; e: EngineMachine }[] = [
  { k: "ls", e: "ls" },
  { k: "gh", e: "gh" },
  { k: "ws", e: "build" },
  { k: "sc", e: "sc" },
  { k: "launch", e: "launch" },
];

function CardChoice({
  board,
  model,
  dispatch,
  tr,
}: {
  board: Board;
  model: Model;
  dispatch: Dispatch<Action>;
  tr: Tr;
}) {
  const g = model.game!;
  if (!board.info.card) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="card">
      <p className="text-sm">{tr(`story.card.${board.info.card}.text`)}</p>
      {board.cardOptions.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {board.cardOptions.map(({ value, preview: p }, i) => (
            <Btn
              key={value}
              data-testid={`card-${value.replace(":", "-")}`}
              active={board.cardChoice === value}
              onClick={() => dispatch({ type: "CHOOSE", card: value })}
              className="flex flex-col items-start text-left text-sm"
            >
              <span>
                {tr(`story.card.${value.replace(":", ".")}`)}
                {features.controls && <Kbd k={String(i + 1)} />}
              </span>
              <span className="text-xs font-normal">
                🔋 {p.left} · <Delta from={g.air} to={p.reserveAfter} /> · 🌱{" "}
                <Delta from={g.plant} to={p.gardenAfter} />
              </span>
            </Btn>
          ))}
        </div>
      )}
    </div>
  );
}

function ShelterChoice({
  board,
  dispatch,
  tr,
  hint,
  onHint,
}: {
  board: Board;
  dispatch: Dispatch<Action>;
  tr: Tr;
  /** Houston's hint is open (state in the HUD, so H and the 🎧 button open it too). */
  hint: boolean;
  onHint: () => void;
}) {
  if (!board.shelterOptions.length) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="shelter">
      <div className="grid grid-cols-3 gap-2">
        {board.shelterOptions.map(({ value, preview: p }, i) => (
          <Btn
            key={value}
            data-testid={`shelter-${value}`}
            active={board.alloc.shelter === value}
            onClick={() => dispatch({ type: "CHOOSE", shelter: value })}
            className="flex flex-col text-sm"
          >
            <span>
              {tr(`ui.shelter.${value}`)}
              {features.controls && <Kbd k={String(board.cardOptions.length + i + 1)} />}
            </span>
            <span className="text-xs font-normal tabular-nums">
              ☢ +{p.doseToday.toFixed(2)}
            </span>
          </Btn>
        ))}
      </div>
      <Btn
        data-testid="ask-houston"
        onClick={onHint}
        active={hint}
        className="text-sm"
      >
        {tr("ui.shelter.askHouston")}
        {features.controls && <Kbd k="H" />}
      </Btn>
      {hint && (
        <p className="text-sm text-white/80">
          {tr(
            board.info.storm === "alert"
              ? "story.houston.alert"
              : "story.houston.storm",
          )}
        </p>
      )}
    </div>
  );
}

function effect(k: Machine, board: Board, model: Model) {
  const g = model.game!;
  const p = board.preview;
  if (!p) return null;
  if (k === "ls") return <Delta from={g.air} to={p.reserveAfter} />;
  if (k === "gh") return <Delta from={g.plant} to={p.gardenAfter} />;
  if (k === "ws") return <Delta from={g.wall} to={p.wallAfter} />;
  if (k === "sc") return <span className="tabular-nums">+{p.sciToday}</span>;
  return <span className="tabular-nums">{board.alloc.launch} / 4</span>;
}

function Machines({
  board,
  model,
  dispatch,
  tr,
}: {
  board: Board;
  model: Model;
  dispatch: Dispatch<Action>;
  tr: Tr;
}) {
  const forced = board.info.forced;
  return (
    <div className="flex flex-col gap-1" data-testid="machines">
      {ROWS.filter((r) => r.k !== "launch" || board.limits.max.launch > 0).map(
        ({ k, e }) => {
          const count = board.alloc[e];
          const max = board.limits.max[e];
          return (
            <div
              key={k}
              className="grid grid-cols-[minmax(0,1fr)_auto_1.75rem_auto_4rem] items-center gap-2"
              data-machine={k}
            >
              <span className="text-sm leading-tight break-words">
                {tr(`ui.machine.${k}`)}
              </span>
              <Btn
                data-testid={`machine-${k}-remove`}
                aria-label={`${tr(`ui.machine.${k}`)} −`}
                disabled={forced || count === 0}
                onClick={() => dispatch({ type: "SET", k, delta: -1 })}
              >
                −
              </Btn>
              <span className="text-center text-lg font-bold tabular-nums">
                {count}
              </span>
              <Btn
                data-testid={`machine-${k}-add`}
                aria-label={`${tr(`ui.machine.${k}`)} +`}
                disabled={forced || max === 0 || count >= max}
                onClick={() => dispatch({ type: "SET", k })}
              >
                +
              </Btn>
              <span className="text-right text-sm">
                {effect(k, board, model)}
              </span>
            </div>
          );
        },
      )}
    </div>
  );
}

export function PlanTablet({
  board,
  model,
  dispatch,
  tr,
  houston,
  onHouston,
  onFold,
}: {
  board: Board;
  model: Model;
  dispatch: Dispatch<Action>;
  tr: Tr;
  houston: boolean;
  onHouston: () => void;
  /** Fold the tablet away (controls layer); without it the tablet has no header. */
  onFold?: () => void;
}) {
  const warning = board.preview?.warning;
  return (
    <Panel className="hud-tablet flex max-h-[62vh] flex-col gap-3 overflow-y-auto" data-testid="plan-tablet">
      {onFold && (
        <div className="-mb-1 flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-widest text-white/60">📟 {tr("ui.controls.tablet")}</span>
          <Btn data-testid="tablet-fold" aria-label={tr("ui.controls.close")} onClick={onFold} className="min-h-10 py-1 text-sm">
            ▾<Kbd k="Tab" />
          </Btn>
        </div>
      )}
      {board.info.forced && (
        <p className="text-sm text-alert">{tr("ui.board.forced")}</p>
      )}
      <CardChoice board={board} model={model} dispatch={dispatch} tr={tr} />
      <ShelterChoice board={board} dispatch={dispatch} tr={tr} hint={houston} onHint={onHouston} />
      <Machines board={board} model={model} dispatch={dispatch} tr={tr} />
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

export function NightTablet({ model, tr }: { model: Model; tr: Tr }) {
  const log = model.game?.log ?? [];
  return (
    <Panel className="flex flex-col gap-1" data-testid="night-log">
      <span className="text-xs uppercase tracking-widest text-white/60">
        {tr("ui.night.title")}
      </span>
      {log.length ? (
        log.map((l) => (
          <p key={l.key} className="text-sm">
            {lineText(l, tr)}
          </p>
        ))
      ) : (
        <p className="text-sm">—</p>
      )}
    </Panel>
  );
}
