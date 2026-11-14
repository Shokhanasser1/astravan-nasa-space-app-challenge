import { useEffect, useMemo, type Dispatch } from 'react';
import { board as selectBoard, truth as selectTruth, type Action, type Model, type View } from '../state/game';
import type { Lang } from '../i18n/t';
import { audio } from '../audio/audio';
import { Btn, makeTr } from './play/kit';
import { DayBadge, Gauges, RadioLine, radioKey } from './play/Visor';
import { NightTablet, PlanTablet } from './play/Tablet';
import { TruthScreen } from './play/TruthScreen';

/**
 * Lane D (Asilbek). DOM layer above the Canvas. This is the PLAYABLE G2 wiring (14 Nov): every control dispatches
 * the right action and every number comes from the engine selectors (`board`, `truth`). The visor design
 * (Dizayn 2.0 §04: rings on objects, wrist tablet, visor edge) restyles or replaces `play/*` — keep the wiring.
 * Text only through keys; the words are written by lane F.
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
  return (
    <div className="pointer-events-auto flex gap-2 self-end">
      {LANGS.map((l) => (
        <Btn key={l} data-testid={`lang-${l}`} active={lang === l} onClick={() => setLang(l)}>
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

  // The day runs by itself and the lander lifts off by itself; the main button skips.
  useEffect(() => {
    if (screen !== 'game' || (phase !== 'run' && phase !== 'launch')) return;
    const id = setTimeout(() => dispatch({ type: 'NEXT' }), phase === 'run' ? RUN_MS : LAUNCH_MS);
    return () => clearTimeout(id);
  }, [phase, screen, model.game?.day, dispatch]);

  const confirmBlocked = phase === 'plan' && board?.preview?.warning === 'engine.warn.chooseCard';
  const primary =
    phase === 'plan'
      ? { label: tr('ui.board.confirmDay'), action: { type: 'CONFIRM' } as const }
      : { label: tr('ui.hud.next'), action: { type: 'NEXT' } as const };

  return (
    <div
      className="pointer-events-none fixed inset-0 flex flex-col justify-between gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      onPointerDown={() => audio.unlock()}
    >
      <div className="flex items-start justify-between gap-2">
        {screen === 'game' && phase !== 'truth' ? <DayBadge view={view} board={board} tr={tr} /> : <span />}
        <TopBar lang={lang} setLang={setLang} sound={sound} setSound={setSound} tr={tr} />
      </div>

      {screen !== 'game' && (
        <div className="pointer-events-auto flex flex-col items-center gap-4 self-center">
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

      {screen === 'game' && phase !== 'truth' && (
        <div className="flex flex-col gap-2" data-phase={phase}>
          {(phase === 'morning' || phase === 'plan') && <RadioLine textKey={radioKey(model, board)} tr={tr} />}
          {phase === 'plan' && board && <PlanTablet board={board} model={model} dispatch={dispatch} tr={tr} />}
          {phase === 'night' && <NightTablet model={model} tr={tr} />}
          <Gauges model={model} board={phase === 'plan' ? board : null} tr={tr} />
          <Btn
            data-testid={phase === 'plan' ? 'confirm-day' : 'next'}
            className="pointer-events-auto w-full text-lg"
            disabled={confirmBlocked}
            onClick={() => dispatch(primary.action)}
          >
            {primary.label}
          </Btn>
        </div>
      )}
    </div>
  );
}
