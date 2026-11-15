import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode } from 'react';
import { ArrowRight, Check, ClipboardList, MessageSquareWarning, Music, VolumeX } from 'lucide-react';
import { atHub, board as selectBoard, truth as selectTruth, type Action, type Model, type View } from '../state/game';
import { armState, armVersion, subscribeArm } from '../arm/state';
import type { Lang } from '../i18n/t';
import { audio } from '../audio/audio';
import { Btn, makeTr } from './play/kit';
import { DayBadge } from './play/Visor';
import { Briefing, CapcomHolo, PhysicsHolo, SunToday } from './play/Holo';
import { HandControl, handsOn } from './play/HandControl';
import { ArmScanner } from './play/ArmScanner';
import { NightTablet, PlanTablet } from './play/Tablet';
import { TruthScreen } from './play/TruthScreen';
import { JumpButton, WalkStick } from './play/WalkStick';
import { CornerButtons, HelpPanel, Kbd, MapPanel, makeApply, touchUi, useGameKeys } from './play/Controls';
import { ResourceBar } from './play/ResourceBar';
import { ContextButton, ContextPrompt, Inventory, contextOf } from './play/Hands';
import { Decision, pendingDecision } from './play/Decision';
import { TaskLine, useTask } from './play/Task';
import { freeWalk } from '../walk/enabled';
import { releaseAll, walkInput } from '../walk/input';
import { features } from '../config/features';
import { canTravel, resolve, type Ctx, type Overlay } from '../controls/act';
import { useAim } from '../controls/bus';
import { setTitle } from '../scene/title';

/**
 * Lane D. DOM layer above the Canvas (15 Nov, "make it a game"): the base's gauges always on top, the task line
 * (tutorial on Day 1, then the day's goal), the carried batteries and a context prompt at the bottom, the day's
 * decision in its own dialog, and the plan list only when asked for. Every control dispatches an existing action
 * and every number comes from the engine selectors (`board`, `truth`, `View.res`). Text only through keys.
 * Where things sit on a phone (portrait, landscape) and a tablet is CSS in src/index.css (`.hud-*`).
 */
const LANGS: Lang[] = ['en', 'uz', 'ru'];
/** The robot arm's hand scanner (it needs the walking astronaut). */
const armScan = features.robotArm && features.character;
const RUN_MS = 4000; // the day runs (≤ 6 s, skippable)
const LAUNCH_MS = 4000;

interface Props {
  model: Model;
  view: View;
  dispatch: Dispatch<Action>;
  lang: Lang;
  setLang: (l: Lang) => void;
  sound: boolean;
  setSound: (s: boolean) => void;
  onStart: () => void;
  onContinue?: () => void;
  /** The reception desk (features.entry): shown instead of the briefing and start buttons outside the game. */
  entry?: ReactNode;
}

function TopBar({ lang, setLang, sound, setSound, tr }: Pick<Props, 'lang' | 'setLang' | 'sound' | 'setSound'> & { tr: (k: string) => string }) {
  // With the controls on, one language button cycles EN → UZ → RU, so the top bar fits a 360 px phone with the map.
  const langs = features.controls ? [lang] : LANGS;
  return (
    <div className="hud-topbar pointer-events-auto flex gap-2 self-start">
      {langs.map((l) => (
        <Btn
          key={l}
          data-testid={features.controls ? 'lang' : `lang-${l}`}
          data-lang={l}
          active={!features.controls && lang === l}
          aria-label={features.controls ? tr('ui.controls.lang') : undefined}
          onClick={() => setLang(features.controls ? LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length] : l)}
        >
          {l.toUpperCase()}
        </Btn>
      ))}
      <Btn data-testid="sound" active={sound} onClick={() => setSound(!sound)} aria-label={tr('ui.hud.sound')}>
        {sound ? <Music size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
      </Btn>
    </div>
  );
}

export function Hud({ model, view, dispatch, lang, setLang, sound, setSound, onStart, onContinue, entry }: Props) {
  const tr = useMemo(() => makeTr(lang), [lang]);
  const board = useMemo(() => selectBoard(model), [model]);
  const truth = useMemo(() => selectTruth(model), [model]);
  const { phase, screen } = model;
  const aim = useAim();
  // The reception desk shows the base through a slow title camera (src/scene/title.ts).
  const titleShot = Boolean(entry) && screen !== 'game';
  useEffect(() => setTitle(titleShot), [titleShot]);
  const day = model.game?.day;
  const planning = phase === 'plan' && board !== null;

  // Windows: the map or the controls list; the plan list (never opens by itself); the day's decision; Houston.
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [listOpen, setListOpen] = useState(false);
  const [houston, setHouston] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [shelterPicked, setShelterPicked] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  useEffect(() => {
    // A new plan opens the decision only when one is waiting; Houston's hint is forgotten.
    setHouston(false);
    setShelterPicked(false);
    setDecisionOpen(phase === 'plan' && pendingDecision(boardRef.current, false));
  }, [phase, day]);
  useEffect(() => {
    // The map is for walking about; it closes when the phase does not allow it (launch, truth, start screen).
    if (!canTravel({ screen, phase })) setOverlay((o) => (o === 'map' ? null : o));
  }, [screen, phase]);

  /** Every action goes through here, so a choice made by key or by button closes the dialog the same way. */
  const act = useCallback(
    (a: Action) => {
      dispatch(a);
      if (a.type !== 'CHOOSE') return;
      const b = boardRef.current;
      const cardLeft = a.card ? false : !!b?.info.card && (b?.cardOptions.length ?? 0) > 0 && !b?.cardChoice;
      const shelterLeft = a.shelter ? false : (b?.shelterOptions.length ?? 0) > 0 && !shelterPicked;
      if (a.shelter) setShelterPicked(true);
      if (!cardLeft && !shelterLeft) setDecisionOpen(false);
    },
    [dispatch, shelterPicked],
  );

  const apply = useMemo(
    () =>
      makeApply(act, {
        setOverlay,
        toggleTablet: () => setListOpen((v) => !v),
        toggleHouston: () => {
          setDecisionOpen(true);
          setHouston((v) => !v);
        },
      }),
    [act],
  );
  const keyCtx: Ctx = { screen, phase, board, aim, overlay, hands: view.hands };
  useGameKeys(keyCtx, features.controls ? apply : () => {});
  /** The touch action button presses E or Q: the same `resolve` as the keys and the scene taps. */
  const press = (kind: 'use' | 'undo') => {
    const effect = resolve({ kind }, keyCtx);
    if (effect) apply(effect);
  };

  // The day runs by itself and the lander lifts off by itself; the main button skips.
  useEffect(() => {
    if (screen !== 'game' || (phase !== 'run' && phase !== 'launch')) return;
    const id = setTimeout(() => dispatch({ type: 'NEXT' }), phase === 'run' ? RUN_MS : LAUNCH_MS);
    return () => clearTimeout(id);
  }, [phase, screen, model.game?.day, dispatch]);

  const dialog = planning && decisionOpen;
  // Free walk: only while the game itself is on screen and no window is open (its keys would walk away under it).
  useEffect(() => {
    walkInput.inGame = screen === 'game' && overlay === null && !dialog;
    if (!walkInput.inGame) releaseAll();
  }, [screen, overlay, dialog]);

  // Night: the gauges as they were while planning, to show what moved.
  const planRes = useRef<View['res']>(undefined);
  if (phase === 'plan' && view.res) planRes.current = view.res;

  const { task, skip } = useTask(model, view, board, aim);
  const ctx = useMemo(() => contextOf(model, board, aim), [model, board, aim]);

  const confirmBlocked = phase === 'plan' && board?.preview?.warning === 'engine.warn.chooseCard';
  const primary =
    phase === 'plan'
      ? { label: tr('ui.board.confirmDay'), action: { type: 'CONFIRM' } as const }
      : { label: tr('ui.hud.next'), action: { type: 'NEXT' } as const };
  const glow = task?.step === 'next' || task?.step === 'confirm' || task?.step === 'rest';

  const playing = screen === 'game' && phase !== 'truth';
  const showList = planning && listOpen;
  const hasDecision = !!board && (board.cardOptions.length > 0 || board.shelterOptions.length > 0);
  const sides = planning && overlay === null && !dialog;
  // the robot arm's scanner takes the upper-left corner while the astronaut stands near the arm
  useSyncExternalStore(subscribeArm, armVersion);
  const armCorner = armScan && (armState.near || armState.on);

  return (
    <div
      className="pointer-events-none fixed inset-0 flex flex-col justify-between gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      data-tablet={showList ? 'open' : 'closed'}
      onPointerDown={() => audio.unlock()}
    >
      <div className="relative z-20 flex shrink-0 flex-col gap-2">
        {/* Portrait: buttons and the day on one row, the gauges below. Landscape phone: all on one row (CSS). */}
        <div className="hud-top flex flex-wrap items-start justify-between gap-2">
          {features.controls ? <CornerButtons map={canTravel({ screen, phase })} open={(ui) => apply({ ui })} tr={tr} /> : null}
          {playing ? <DayBadge view={view} board={board} tr={tr} /> : <span />}
          <TopBar lang={lang} setLang={setLang} sound={sound} setSound={setSound} tr={tr} />
          {playing && !overlay && view.res && <ResourceBar res={view.res} tr={tr} />}
        </div>
        {playing && !overlay && task && (phase === 'morning' || phase === 'plan') && (
          <TaskLine task={task} tr={tr} onSkip={task.step ? skip : undefined} />
        )}
        {/* (the Sun photo steps aside while the robot arm's scanner has the upper-left corner: near the arm) */}
        {playing && !overlay && (phase === 'morning' || phase === 'plan') && !armCorner && (
          <div className="hud-sun pointer-events-none self-start">
            <SunToday weekId={view.weekId} date={view.mediaDate} tr={tr} />
          </div>
        )}
      </div>

      {overlay && (
        <div className="pointer-events-auto flex min-h-0 flex-1 items-center justify-center">
          {overlay === 'map' ? <MapPanel apply={apply} tr={tr} /> : <HelpPanel apply={apply} tr={tr} />}
        </div>
      )}

      {screen !== 'game' && !overlay && entry}

      {screen !== 'game' && !overlay && !entry && (
        <div className="pointer-events-auto flex flex-col items-center gap-4 self-center">
          <Briefing tr={tr} lang={lang} sound={sound} />
          <Btn data-testid="start-mission" className="primary big" onClick={onStart}>
            {tr('ui.start.mission')}
            <ArrowRight size={20} aria-hidden="true" />
          </Btn>
          {onContinue && (
            <Btn data-testid="continue" onClick={onContinue}>
              {tr('ui.start.continue')}
            </Btn>
          )}
        </div>
      )}

      {screen === 'game' && phase === 'truth' && truth && <TruthScreen truth={truth} dispatch={dispatch} tr={tr} />}

      {playing && features.character && (
        <div className="pointer-events-none absolute right-4 top-48 flex flex-col">
          <PhysicsHolo tr={tr} />
        </div>
      )}

      {handsOn && !overlay && (
        <div className="pointer-events-none absolute left-4 top-1/2">
          <HandControl tr={tr} />
        </div>
      )}
      {/* (the robot arm's scanner: its button shows only near the arm, under the map and help buttons; the panel opens
          beside it, above the radio card and the big button) */}
      {armScan && playing && !overlay && (
        // (phones, upright or on their side: the button stays left, the panel goes to the right edge, clear of the walk
        // stick, the jump button and the centre column; wide and tall screens keep both together on the left)
        <div
          className={`pointer-events-none absolute top-28 ${handsOn ? 'right-4' : 'left-4 right-4 sm:[@media(min-height:501px)]:right-auto'}`}
        >
          <ArmScanner tr={tr} />
        </div>
      )}

      {freeWalk && sides && <WalkStick />}
      {features.controls && touchUi && sides && (
        <ContextButton ctx={ctx} press={press} tr={tr}>
          {freeWalk && features.character && <JumpButton />}
        </ContextButton>
      )}

      {dialog && board && (
        <Decision
          shelterPicked={shelterPicked}
          board={board}
          model={model}
          dispatch={act}
          tr={tr}
          hint={houston}
          onHint={() => setHouston((v) => !v)}
          onClose={() => setDecisionOpen(false)}
        />
      )}

      {playing && !overlay && (
        <div className="hud-center flex min-h-0 flex-col gap-2 [&>*]:shrink-0" data-phase={phase}>
          {(phase === 'morning' || phase === 'plan') && (
            <CapcomHolo textKey={task?.radio ?? null} tr={tr} lang={lang} sound={sound} collapsible />
          )}
          {phase === 'night' && <NightTablet model={model} before={planRes.current} after={view.res} tr={tr} />}
          {showList && !dialog && <PlanTablet board={board} model={model} dispatch={act} tr={tr} onFold={() => setListOpen(false)} />}
          {planning && ctx && !dialog && !showList && <ContextPrompt ctx={ctx} tr={tr} />}
          {planning && (
            <div className="flex items-end justify-between gap-2">
              {!board.info.forced ? (
                <Inventory hands={view.hands ?? 0} free={atHub(model)} total={view.batteries?.total ?? 0} tr={tr} />
              ) : (
                <span />
              )}
              <div className="hud-btns flex flex-col items-end gap-2">
                {hasDecision && (
                  <Btn data-testid="decision-open" className="solid pointer-events-auto text-sm" onClick={() => setDecisionOpen(true)}>
                    <MessageSquareWarning size={18} aria-hidden="true" /> {tr('ui.decide.open')}
                  </Btn>
                )}
                <Btn data-testid="tablet-open" active={listOpen} className="solid pointer-events-auto text-sm" onClick={() => setListOpen((v) => !v)}>
                  <ClipboardList size={18} aria-hidden="true" /> {tr('ui.plan.open')}
                  <Kbd k="Tab" />
                </Btn>
              </div>
            </div>
          )}
          <Btn
            data-testid={phase === 'plan' ? 'confirm-day' : 'next'}
            className={`primary big pointer-events-auto w-full ${glow ? 'glow' : ''}`}
            disabled={confirmBlocked}
            onClick={() => dispatch(primary.action)}
          >
            {primary.label}
            {phase === 'plan' ? <Check size={20} aria-hidden="true" /> : <ArrowRight size={20} aria-hidden="true" />}
            {features.controls && <Kbd k="Enter" />}
          </Btn>
        </div>
      )}
    </div>
  );
}
