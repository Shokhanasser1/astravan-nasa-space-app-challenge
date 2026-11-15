import { useEffect, useMemo, useState } from 'react';
import { Target, X } from 'lucide-react';
import type { AimId } from '../../controls/bus';
import { atHub, type Board, type Model, type View } from '../../state/game';
import { setObjective, type ObjectiveTarget } from '../../state/objective';
import { dayGoal, radioLine, tutorialStep, tutorialSay, tutorialTarget, tutorialTask, type DayFacts, type TutStep } from '../tutorial';
import type { Tr } from './kit';

/**
 * The player's current task: the tutorial step on the first mission's Day 1, then the day's goal. It writes the
 * objective channel (src/state/objective.ts) so the scene puts a beacon over the target, and marks the task idle
 * after 7 s without progress (the beacon and the task line pulse). Words only; no game number is computed.
 */
const IDLE_MS = 7000;

export interface Task {
  key: string;
  target: ObjectiveTarget;
  /** CAPCOM line said with this task (tutorial), else the day's radio line. */
  radio: string | null;
  step: TutStep | null;
  idle: boolean;
}

export function useTask(model: Model, view: View, board: Board | null, aim: AimId | null): { task: Task | null; skip: () => void } {
  // The tutorial belongs to a child's first mission (model.firstMission, set per badge in App.tsx), not to the
  // device: on a shared class tablet every new badge and every guest gets it. "Skip" ends it for this game only.
  const [skipped, setSkipped] = useState<number | null>(null);
  const done = skipped === model.seed;
  const day = model.game?.day ?? 1;
  const hands = model.hands ?? 0;
  const step =
    !done && model.screen === 'game'
      ? tutorialStep({ phase: model.phase, day, firstMission: model.firstMission, hands, alloc: view.alloc, aim, free: atHub(model) })
      : null;

  // (The tutorial is Day 1 only: tutorialStep returns null from Day 2 on.)
  const skip = () => setSkipped(model.seed);

  const facts: DayFacts | null = board
    ? { day, phase: model.phase, card: board.info.card, choice: board.info.choice, alert: board.info.alert, forced: board.info.forced }
    : null;
  const radio = facts && board ? radioLine({ ...facts, storm: board.info.storm, watch: board.info.watch }) : null;
  const base = useMemo(() => {
    if (step) {
      return { key: tutorialTask(step, hands), target: tutorialTarget(step, hands), radio: step === 'next' ? radio : tutorialSay(step), step };
    }
    const goal = facts ? dayGoal(facts) : null;
    return goal ? { ...goal, radio, step: null } : null;
    // (facts is rebuilt every render; its fields are the real dependencies)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hands, radio, facts?.day, facts?.phase, facts?.card, facts?.choice, facts?.alert, facts?.forced]);

  // Idle: no progress (task, hands or batteries placed) for 7 s.
  const [idle, setIdle] = useState(false);
  const progress = `${base?.key}|${hands}|${view.alloc.ls}|${view.alloc.gh}|${view.alloc.ws}|${view.alloc.sc}|${view.alloc.launch}|${model.phase}`;
  useEffect(() => {
    setIdle(false);
    if (!base) return;
    const id = window.setTimeout(() => setIdle(true), IDLE_MS);
    return () => window.clearTimeout(id);
  }, [progress, base]);

  const target = model.phase === 'plan' ? (base?.target ?? null) : null;
  useEffect(() => {
    setObjective({ key: base?.key ?? null, target, idle: idle && !!base });
  }, [base, target, idle]);
  useEffect(() => () => setObjective({ key: null, target: null, idle: false }), []);

  return { task: base ? { ...base, target, idle } : null, skip };
}

/** Top-left: "🎯 Task: …" — it pulses when the player has been stuck for a while. */
export function TaskLine({ task, tr, onSkip }: { task: Task; tr: Tr; onSkip?: () => void }) {
  return (
    <div
      className={`holo pointer-events-auto flex max-w-[22rem] items-center gap-2 self-start rounded-[16px] py-1.5 pl-2.5 pr-1.5 ${task.idle ? 'task-idle' : ''}`}
      data-testid="task"
      data-step={task.step ?? undefined}
      data-idle={task.idle ? 'true' : 'false'}
    >
      <Target size={20} aria-hidden="true" className="shrink-0 text-accent" />
      <p className="text-base font-semibold leading-snug">
        <span className="mr-1 text-xs font-bold uppercase tracking-wide text-accent">{tr(task.step ? 'ui.tut.label' : 'ui.goal.label')}</span>
        {tr(task.key)}
      </p>
      {onSkip && (
        <button type="button" data-testid="tutorial-skip" className="abtn ml-1 !min-h-12 shrink-0 !rounded-full !px-2.5 !py-1 text-xs" onClick={onSkip}>
          {tr('ui.tut.skip')}
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
