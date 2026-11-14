import { useEffect, useMemo, useState, type Dispatch } from 'react';
import { board as selectBoard, truth as selectTruth, type Action, type Model, type View } from '../state/game';
import type { Lang } from '../i18n/t';
import { audio } from '../audio/audio';
import { Btn, makeTr } from './play/kit';
import { DayBadge, Gauges, radioKey } from './play/Visor';
import { Briefing, CapcomHolo, PhysicsHolo, SunToday } from './play/Holo';
import { NightTablet, PlanTablet } from './play/Tablet';
import { TruthScreen } from './play/TruthScreen';
import { JumpButton, WalkStick } from './play/WalkStick';
import { ActionPad, CornerButtons, HelpPanel, Kbd, MapPanel, makeApply, touchUi, useGameKeys } from './play/Controls';
import { freeWalk } from '../walk/enabled';
import { releaseAll, walkInput } from '../walk/input';
import { features } from '../config/features';
import { canTravel, type Overlay } from '../controls/act';
import { useAim } from '../controls/bus';

/**
 * Lane D (Asilbek). DOM layer above the Canvas. This is the PLAYABLE G2 wiring (14 Nov): every control dispatches
 * the right action and every number comes from the engine selectors (`board`, `truth`). The visor design
 * (Dizayn 2.0 §04: rings on objects, wrist tablet, visor edge) restyles or replaces `play/*` — keep the wiring.
 * Text only through keys; the words are written by lane F.
 *
 * Controls (features.controls, docs/specs/2026-11-14-controls-guide.html): game keys, the touch action pad on the
 * right, the walk stick on the left, the base map and the controls list top left. Where they sit on a phone
 * (portrait, landscape) and a tablet is CSS in src/index.css (`.hud-*`).
 */
const LANGS: Lang[] = ['en', 'uz', 'ru'];
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
}

function TopBar({ lang, setLang, sound, setSound, tr }: Pick<Props, 'lang' | 'setLang' | 'sound' | 'setSound'> & { tr: (k: string) => string }) {
  // With the controls on, one language button cycles EN → UZ → RU, so the top bar fits a 360 px phone with the map.
  const langs = features.controls ? [lang] : LANGS;
  return (
    <div className="pointer-events-auto flex gap-2 self-start">
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
        ♪
      </Btn>
    </div>
  );
}

export function Hud({ model, view, dispatch, lang, setLang, sound, setSound, onStart, onContinue }: Props) {
  const tr = useMemo(() => makeTr(lang), [lang]);
  const board = useMemo(() => selectBoard(model), [model]);
  const truth = useMemo(() => selectTruth(model), [model]);
  const { phase, screen } = model;
  const aim = useAim();

  // Windows of the controls layer: the map or the controls list; the wrist tablet open or folded; Houston's hint.
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tabletOpen, setTabletOpen] = useState(true);
  const [houston, setHouston] = useState(false);
  const day = model.game?.day;
  useEffect(() => {
    // A new day or phase opens the tablet again and forgets the hint.
    setTabletOpen(true);
    setHouston(false);
  }, [phase, day]);
  useEffect(() => {
    // The map is for walking about; it closes when the phase does not allow it (launch, truth, start screen).
    if (!canTravel({ screen, phase })) setOverlay((o) => (o === 'map' ? null : o));
  }, [screen, phase]);

  const apply = useMemo(
    () =>
      makeApply(dispatch, {
        setOverlay,
        toggleTablet: () => setTabletOpen((v) => !v),
        toggleHouston: () => {
          setTabletOpen(true);
          setHouston((v) => !v);
        },
      }),
    [dispatch],
  );
  useGameKeys({ screen, phase, board, aim, overlay }, features.controls ? apply : () => {});

  // The day runs by itself and the lander lifts off by itself; the main button skips.
  useEffect(() => {
    if (screen !== 'game' || (phase !== 'run' && phase !== 'launch')) return;
    const id = setTimeout(() => dispatch({ type: 'NEXT' }), phase === 'run' ? RUN_MS : LAUNCH_MS);
    return () => clearTimeout(id);
  }, [phase, screen, model.game?.day, dispatch]);

  // Free walk: only while the game itself is on screen (never behind the start or the end screen) and no window
  // of the controls layer is open (its keys would walk the astronaut away under the map).
  useEffect(() => {
    walkInput.inGame = screen === 'game' && overlay === null;
    if (!walkInput.inGame) releaseAll();
  }, [screen, overlay]);

  const confirmBlocked = phase === 'plan' && board?.preview?.warning === 'engine.warn.chooseCard';
  const primary =
    phase === 'plan'
      ? { label: tr('ui.board.confirmDay'), action: { type: 'CONFIRM' } as const }
      : { label: tr('ui.hud.next'), action: { type: 'NEXT' } as const };

  const playing = screen === 'game' && phase !== 'truth';
  const planning = phase === 'plan' && board !== null;
  const showTablet = planning && (!features.controls || tabletOpen);
  const sides = playing && phase !== 'launch' && overlay === null;

  return (
    <div
      className="pointer-events-none fixed inset-0 flex flex-col justify-between gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      data-tablet={showTablet ? 'open' : 'closed'}
      onPointerDown={() => audio.unlock()}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        {features.controls ? <CornerButtons map={canTravel({ screen, phase })} open={(ui) => apply({ ui })} tr={tr} /> : null}
        {playing ? <DayBadge view={view} board={board} tr={tr} /> : <span />}
        <TopBar lang={lang} setLang={setLang} sound={sound} setSound={setSound} tr={tr} />
      </div>

      {overlay && (
        <div className="pointer-events-auto flex min-h-0 flex-1 items-center justify-center">
          {overlay === 'map' ? <MapPanel apply={apply} tr={tr} /> : <HelpPanel apply={apply} tr={tr} />}
        </div>
      )}

      {screen !== 'game' && !overlay && (
        <div className="pointer-events-auto flex flex-col items-center gap-4 self-center">
          <Briefing tr={tr} lang={lang} sound={sound} />
          <Btn data-testid="start-mission" onClick={onStart}>
            {tr('ui.start.mission')}
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
        <div className="pointer-events-none absolute right-4 top-20 flex flex-col">
          <PhysicsHolo tr={tr} />
        </div>
      )}
      {/* (Its own corner: in the centre column it pushed Confirm off a laptop screen on the flare day.) */}
      {playing && !overlay && (phase === 'morning' || phase === 'plan') && (
        <div className="pointer-events-none absolute left-4 top-36 flex flex-col">
          <SunToday weekId={view.weekId} date={view.mediaDate} tr={tr} />
        </div>
      )}

      {freeWalk && sides && <WalkStick />}
      {freeWalk && sides && features.character && <JumpButton />}
      {features.controls && touchUi && sides && planning && <ActionPad board={board} aim={aim} apply={apply} tr={tr} />}

      {playing && !overlay && (
        <div className="hud-center flex flex-col gap-2" data-phase={phase}>
          {(phase === 'morning' || phase === 'plan') && <CapcomHolo textKey={radioKey(model, board)} tr={tr} lang={lang} sound={sound} />}
          {showTablet && (
            <PlanTablet
              board={board}
              model={model}
              dispatch={dispatch}
              tr={tr}
              houston={houston}
              onHouston={() => setHouston((v) => !v)}
              onFold={features.controls ? () => setTabletOpen(false) : undefined}
            />
          )}
          {planning && features.controls && !tabletOpen && !touchUi && (
            // (Phones and tablets have the 📟 button of the action pad.) Dark: it often sits on a lit wall.
            <Btn data-testid="tablet-open" className="pointer-events-auto self-center !bg-black/70 text-sm" onClick={() => setTabletOpen(true)}>
              📟 {tr('ui.controls.tablet')}
              <Kbd k="Tab" />
            </Btn>
          )}
          {phase === 'night' && <NightTablet model={model} tr={tr} />}
          <Gauges model={model} board={phase === 'plan' ? board : null} tr={tr} />
          <Btn
            data-testid={phase === 'plan' ? 'confirm-day' : 'next'}
            className="pointer-events-auto w-full text-lg"
            disabled={confirmBlocked}
            onClick={() => dispatch(primary.action)}
          >
            {primary.label}
            {features.controls && <Kbd k="Enter" />}
          </Btn>
        </div>
      )}
    </div>
  );
}
