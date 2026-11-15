import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode } from 'react';
import { ArrowRight, Check, ClipboardList, MessageSquareWarning, Music, VolumeX } from 'lucide-react';
import { atHub, board as selectBoard, truth as selectTruth, type Action, type Model, type View } from '../state/game';
import { armState, armVersion, subscribeArm } from '../arm/state';
import type { Lang } from '../i18n/t';
import { audio } from '../audio/audio';
import { Btn, makeTr } from './play/kit';
import { DayBadge } from './play/Visor';
import { Briefing, CapcomHolo, PhysicsHolo, SunToday } from './play/Holo';
import { HandControl, handsOn } from './play/HandControl';
import { JumpButton, RideButton, WalkStick } from './play/WalkStick';
import { CornerButtons, HelpPanel, Kbd, MapPanel, makeApply, touchUi, useGameKeys } from './play/Controls';
import { ResourceBar } from './play/ResourceBar';
import { HomeBar } from './play/HomeBar';
import { DayTasks } from './play/DayTasks';
import { NightFact } from './play/NightFact';
import { ContextButton, ContextPrompt, Inventory, contextOf } from './play/Hands';
import { Decision, pendingDecision } from './play/Decision';
import { TaskLine, useTask } from './play/Task';
import { debriefQuiz, nightQuiz } from '../quiz/quiz';
import { freeWalk } from '../walk/enabled';
import { releaseAll, walkInput } from '../walk/input';
import { features } from '../config/features';
import { canTravel, resolve, type Ctx, type Overlay } from '../controls/act';
import { useAim, useRide } from '../controls/bus';
import { setTitle } from '../scene/title';
import { runMs } from '../scene/runClock';
import { bedtime } from '../state/homeDay';
import { DayRun } from './play/DayRun';
import { NightTablet, PlanTablet } from './play/Tablet';
import { Quiz } from './play/Quiz';
import { TruthScreen } from './play/TruthScreen';
import { lazyScreen, whenIdle } from './lazy';

// Only the camera arm scanner (a child's choice, never in the week's flow) loads as its own chunk, its import started
// on idle. Screens of the week's flow stay in the main chunk: a lazy screen suspends for a tick on its first show even
// when cached — the quiz and then the truth screen appeared a moment late and the e2e week clicked Next under or past
// them (15 Nov). Together they saved only ~6 kB gzip.
const ArmScanner = lazyScreen(() => import('./play/ArmScanner').then((m) => ({ default: m.ArmScanner })));

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
          className="solid" // (on the white habitat the glass button's light text vanished)
          active={!features.controls && lang === l}
          aria-label={features.controls ? tr('ui.controls.lang') : undefined}
          onClick={() => setLang(features.controls ? LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length] : l)}
        >
          {l.toUpperCase()}
        </Btn>
      ))}
      <Btn data-testid="sound" className="solid" active={sound} onClick={() => setSound(!sound)} aria-label={tr('ui.hud.sound')}>
        {sound ? <Music size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
      </Btn>
    </div>
  );
}

export function Hud({ model, view, dispatch, lang, setLang, sound, setSound, onStart, onContinue, entry }: Props) {
  const tr = useMemo(() => makeTr(lang), [lang]);
  useEffect(
    () =>
      whenIdle(() => {
        if (armScan) ArmScanner.preload();
      }),
    [],
  );
  const board = useMemo(() => selectBoard(model), [model]);
  const truth = useMemo(() => selectTruth(model), [model]);
  const { phase, screen } = model;
  const aim = useAim();
  // The reception desk shows the base through a slow title camera (src/scene/title.ts).
  const titleShot = Boolean(entry) && screen !== 'game';
  useEffect(() => setTitle(titleShot), [titleShot]);
  const ride = useRide();
  const day = model.game?.day;
  const planning = phase === 'plan' && board !== null;
  // Home story (src/state/homeDay.ts): once a day has run it waits for Sleep — the button, or E at the habitat door
  // with the walking astronaut; inside all day ("Stay inside all day", the backup-tank day) the base is run from the
  // Plan list.
  const bed = features.homeStory && features.character && screen === 'game' && bedtime(phase, view.day);
  const indoors = features.homeStory && planning && Boolean(view.indoors);

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
  // Mission quiz (features.quiz, src/quiz/quiz.ts): a radio check on some nights, the debrief after the truth
  // screen. Each one must be passed before Next goes on; nothing is saved (the same mission asks the same again).
  const [quizOpen, setQuizOpen] = useState(false);
  const [passed, setPassed] = useState<string[]>([]);
  const quizInput = useMemo(
    () => (features.quiz && model.week && model.game ? { week: model.week, game: model.game, picks: model.picks, seed: model.seed } : null),
    [model.week, model.game, model.picks, model.seed],
  );
  const quizKey = phase === 'night' ? `${model.seed}:n${(day ?? 1) - 1}` : phase === 'truth' ? `${model.seed}:debrief` : '';
  const quizQs = useMemo(() => {
    if (!quizInput || screen !== 'game') return [];
    if (phase === 'night') return nightQuiz(quizInput, quizInput.game.day - 1);
    if (phase === 'truth') return debriefQuiz(quizInput);
    return [];
  }, [quizInput, phase, screen]);
  const quizPending = quizQs.length > 0 && !passed.includes(quizKey);
  useEffect(() => setQuizOpen(false), [phase, day]);
  /** Next (button or key) with a quiz still to pass opens the quiz instead. */
  const nextOrQuiz = useCallback(() => {
    if (quizPending) setQuizOpen(true);
    else dispatch({ type: 'NEXT' });
  }, [quizPending, dispatch]);

  // (while the quiz window is open the game's keys are off: it takes 1–3 and Enter for itself)
  const keyCtx: Ctx = { screen, phase, board, aim, overlay: quizOpen ? 'help' : overlay, hands: view.hands, ride };
  const keyApply = useCallback(
    (e: Parameters<typeof apply>[0]) => {
      if (quizOpen) return;
      if ('action' in e && e.action.type === 'NEXT' && quizPending) return setQuizOpen(true);
      apply(e);
    },
    [apply, quizOpen, quizPending],
  );
  useGameKeys(keyCtx, features.controls ? keyApply : () => {});
  /** The touch action button presses E or Q: the same `resolve` as the keys and the scene taps. */
  const press = (kind: 'use' | 'undo') => {
    const effect = resolve({ kind }, { ...keyCtx, ride: null }); // (E at the rover is the keyboard's and the 🚙 button's)
    if (effect) apply(effect);
  };

  // The day runs by itself and the lander lifts off by itself; the main button skips.
  useEffect(() => {
    if (screen !== 'game' || (phase !== 'run' && phase !== 'launch') || bed) return;
    // (a day whose measured hours change runs 6 s, a calm one 4 s: src/scene/runClock.ts runMs)
    const id = setTimeout(() => dispatch({ type: 'NEXT' }), phase === 'run' ? runMs(view.hourly) : LAUNCH_MS);
    return () => clearTimeout(id);
  }, [phase, screen, model.game?.day, dispatch, view.hourly, bed]);

  // Inside all day: the Plan list opens by itself (the only way to place batteries from in there), and batteries
  // still in the hands go back to the hub.
  useEffect(() => {
    if (!indoors) return;
    setListOpen(true);
    if ((model.hands ?? 0) > 0) dispatch({ type: 'DROP' });
    // (only when the crew goes in, not on every change of the hands)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indoors, dispatch]);

  const dialog = planning && decisionOpen;
  // Free walk: only while the game itself is on screen and no window is open (its keys would walk away under it).
  useEffect(() => {
    walkInput.inGame = screen === 'game' && overlay === null && !dialog && !quizOpen;
    if (!walkInput.inGame) releaseAll();
  }, [screen, overlay, dialog, quizOpen]);

  // Night: the gauges as they were while planning, to show what moved.
  const planRes = useRef<View['res']>(undefined);
  if (phase === 'plan' && view.res) planRes.current = view.res;

  const { task, skip } = useTask(model, view, board, aim);
  const ctx = useMemo(() => contextOf(model, board, aim), [model, board, aim]);

  const confirmBlocked = phase === 'plan' && board?.preview?.warning === 'engine.warn.chooseCard';
  // (home story: the day runs → "Sleep"; the night card → "Wake up"; the plan's button reads "Start the day")
  const nextLabel = features.homeStory && phase === 'run' ? 'ui.hud.sleep' : features.homeStory && phase === 'night' ? 'ui.hud.wakeUp' : 'ui.hud.next';
  const primary =
    phase === 'plan'
      ? { label: tr('ui.board.confirmDay'), action: { type: 'CONFIRM' } as const }
      : { label: tr(nextLabel), action: { type: 'NEXT' } as const };
  const glow = task?.step === 'next' || task?.step === 'confirm' || task?.step === 'rest' || bed;

  const playing = screen === 'game' && phase !== 'truth';
  const showList = planning && listOpen;
  const hasDecision = !!board && (board.cardOptions.length > 0 || board.shelterOptions.length > 0);
  const sides = planning && overlay === null && !dialog;
  // (bedtime: the stick and the door's Sleep button, to walk the astronaut to the habitat door)
  const bedWalk = bed && overlay === null && !quizOpen;
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
          {playing && !overlay && view.res && (features.homeStory ? <HomeBar res={view.res} batteries={view.batteries} tr={tr} /> : <ResourceBar res={view.res} tr={tr} />)}
        </div>
        {/* (home story: from Day 2, or once the Day 1 tutorial is done, the plan shows Today's 5 instead of one line) */}
        {playing && !overlay && features.homeStory && phase === 'plan' && !task?.step ? (
          <DayTasks model={model} tr={tr} />
        ) : (
          playing &&
          !overlay &&
          task &&
          (phase === 'morning' || phase === 'plan') && <TaskLine task={task} tr={tr} onSkip={task.step ? skip : undefined} />
        )}
        {/* (the Sun photo steps aside while the robot arm's scanner has the upper-left corner: near the arm) */}
        {playing && !overlay && (phase === 'morning' || phase === 'plan') && !armCorner && (
          <div className="hud-sun pointer-events-none self-start">
            <SunToday weekId={view.weekId} date={view.mediaDate} tr={tr} />
          </div>
        )}
        {/* The robot arm's scanner: its button shows only near the arm, hung just under this top column (buttons, day,
            resources, task), so it never sits on them and takes no room in the layout. Phones, upright or on their
            side: the button stays left, the panel goes to the right edge, clear of the walk stick and the jump button;
            wide and tall screens keep both together on the left. */}
        {armScan && playing && !overlay && (
          <div
            className={`pointer-events-none absolute top-full mt-2 ${handsOn ? 'right-0' : 'left-0 right-0 sm:[@media(min-height:501px)]:right-auto'}`}
          >
            <Suspense fallback={null}>
              <ArmScanner tr={tr} />
            </Suspense>
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

      {screen === 'game' && phase === 'truth' && truth && (
        <TruthScreen truth={truth} dispatch={dispatch} tr={tr} onNext={quizPending ? nextOrQuiz : undefined} ship={view.res?.ship} />
      )}

      {quizOpen && quizPending && (
        <Quiz
          key={quizKey}
          kind={phase === 'truth' ? 'debrief' : 'night'}
          questions={quizQs}
          tr={tr}
          lang={lang}
          sound={sound}
          onDone={() => {
            setPassed((p) => [...p, quizKey]);
            setQuizOpen(false);
            dispatch({ type: 'NEXT' });
          }}
        />
      )}

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
      {freeWalk && (sides || bedWalk) && <WalkStick />}
      {features.controls && touchUi && sides && (
        <ContextButton ctx={ctx} press={press} tr={tr}>
          {freeWalk && features.character && <JumpButton />}
        </ContextButton>
      )}

      {(sides || bedWalk) && <RideButton ride={ride} onSleep={() => dispatch({ type: 'NEXT' })} />}

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
          {phase === 'run' && <DayRun view={view} ms={runMs(view.hourly)} sound={sound} tr={tr} />}
          {bed && (
            <p className="holo pointer-events-none self-start rounded-[16px] px-3 py-1.5 text-sm font-semibold" data-testid="sleep-hint">
              {tr('ui.sleep.hint')}
            </p>
          )}
          {phase === 'night' && <NightTablet model={model} before={planRes.current} after={view.res} tr={tr} />}
          {features.homeStory && phase === 'night' && <NightFact model={model} tr={tr} lang={lang} />}
          {indoors && showList && !dialog && !board.info.forced && (
            <p className="holo pointer-events-none self-start rounded-[16px] px-3 py-1.5 text-sm font-semibold" data-testid="inside-hint">
              {tr('ui.inside.plan')}
            </p>
          )}
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
            onClick={() => (primary.action.type === 'NEXT' ? nextOrQuiz() : dispatch(primary.action))}
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
