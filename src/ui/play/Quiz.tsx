import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ArrowRight, Ban, BatteryFull, Bed, CalendarCheck, CircleAlert, CircleCheck, CircleHelp, Clock, Droplet, Feather, Flame,
  Footprints, Gauge, Hammer, Hourglass, House, HousePlus, Minus, Pickaxe, Radiation, Radio, RotateCcw, Shirt, Snowflake,
  Sparkles, Sprout, Star, Sun, Timer, TrendingDown, TrendingUp, Volume2, Wind, Wrench, Zap,
} from 'lucide-react';
import type { Lang } from '../../i18n/t';
import { audio } from '../../audio/audio';
import type { IconName, Question } from '../../quiz/quiz';
import { Btn, Panel, type Tr } from './kit';
import { Mark } from './Holo';

/**
 * The mission quiz window (src/quiz/quiz.ts decides what to ask): a radio check on some nights, the debrief after
 * the truth screen. Big picture answers (icon + a few words), one question at a time. A wrong answer is never a
 * dead end: the child sees why — with their own day's numbers — and tries again with the answers in a new order.
 * Answers right on the first try become the debrief's stars. Works without sound; "Read aloud" for en and ru.
 */
type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>;

const ICONS: Record<IconName, Icon> = {
  droplet: Droplet, wind: Wind, sprout: Sprout, hammer: Hammer, house: House, housePlus: HousePlus, pickaxe: Pickaxe,
  sun: Sun, zap: Zap, flame: Flame, snowflake: Snowflake, battery: BatteryFull, radiation: Radiation, minus: Minus,
  clock: Clock, help: CircleHelp, feather: Feather, radio: Radio, bed: Bed, footprints: Footprints, up: TrendingUp,
  down: TrendingDown, gauge: Gauge, shirt: Shirt, calendar: CalendarCheck, ban: Ban, wrench: Wrench, timer: Timer,
  hourglass: Hourglass, sparkles: Sparkles,
};

export function Quiz({
  kind, questions, tr, lang, sound, onDone,
}: {
  kind: 'night' | 'debrief';
  questions: Question[];
  tr: Tr;
  lang: Lang;
  sound: boolean;
  /** Called when every question is answered right (debrief: after the "next mission" card). */
  onDone: (firstTry: boolean[]) => void;
}) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [missed, setMissed] = useState<boolean[]>(() => questions.map(() => false));
  const [turn, setTurn] = useState(0); // each retry shows the answers in a new order
  const [finished, setFinished] = useState(false);

  const q = questions[Math.min(i, questions.length - 1)];
  const options = useMemo(() => {
    const k = turn % q.options.length;
    return [...q.options.slice(k), ...q.options.slice(0, k)];
  }, [q, turn]);
  const right = picked !== null && picked === q.answer;
  const firstTry = missed.map((m) => !m);

  const choose = (id: string) => {
    if (picked !== null) return;
    setPicked(id);
    if (id !== q.answer) setMissed((m) => m.map((v, j) => (j === i ? true : v)));
  };
  const retry = () => {
    setPicked(null);
    setTurn((t) => t + 1);
  };
  const next = () => {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setPicked(null);
      setTurn(0);
    } else if (kind === 'debrief') setFinished(true);
    else onDone(firstTry);
  };

  // Keys: 1–3 answer, Enter goes on (the game's own keys are off while this window is open).
  const keyRef = { choose, retry, next, picked, right, finished, options };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = keyRef;
      if (e.repeat) return;
      if (k.finished) {
        if (e.key === 'Enter') {
          e.preventDefault(); // (the focused "Next mission" button would press it a second time)
          onDone(firstTry);
        }
        return;
      }
      const n = Number(e.key);
      if (k.picked === null && n >= 1 && n <= k.options.length) k.choose(k.options[n - 1].id);
      else if (k.picked !== null && e.key === 'Enter') {
        e.preventDefault();
        if (k.right) k.next();
        else k.retry();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const speak = () => {
    if (lang === 'uz') return;
    const words = [tr(q.prompt.key, q.prompt.vars), ...options.map((o, j) => `${j + 1}. ${tr(o.text.key, o.text.vars)}`)];
    audio.speak(words.join('. '), lang);
  };

  return (
    <div className="decision-wrap pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#050816]/60 p-4">
      <Panel
        className="holo-in flex max-h-[88dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto"
        data-testid="quiz"
        data-kind={kind}
        role="dialog"
        aria-modal="true"
        aria-label={tr(`quiz.ui.${kind}`)}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow !text-[#c2cbec]">{tr(`quiz.ui.${kind}`)}</span>
          {!finished && questions.length > 1 && (
            <span className="text-xs tabular-nums text-white/70">{tr('quiz.ui.progress', { i: i + 1, n: questions.length })}</span>
          )}
        </div>

        {finished ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center" data-testid="quiz-done">
            <p className="title-grad text-2xl font-bold">{tr('quiz.ui.doneTitle')}</p>
            <div className="flex gap-2" aria-label={tr('quiz.ui.stars', { n: firstTry.filter(Boolean).length, total: questions.length })}>
              {firstTry.map((ok, j) => (
                <Star key={j} size={36} aria-hidden="true" className={ok ? 'fill-current text-accent' : 'text-white/30'} />
              ))}
            </div>
            <p className="text-sm text-white/80">{tr('quiz.ui.stars', { n: firstTry.filter(Boolean).length, total: questions.length })}</p>
            <p className="text-lg font-semibold">{tr('quiz.ui.doneText')}</p>
            <Btn data-testid="quiz-finish" className="primary big w-full" onClick={() => onDone(firstTry)} autoFocus>
              {tr('quiz.ui.go')}
              <ArrowRight size={20} aria-hidden="true" />
            </Btn>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <p className="flex-1 text-lg font-semibold leading-snug" data-testid="quiz-question" data-template={q.template}>
                {tr(q.prompt.key, q.prompt.vars)}
              </p>
              {lang !== 'uz' && sound && (
                <Btn aria-label={tr('quiz.ui.listen')} onClick={speak} className="icon-btn shrink-0">
                  <Volume2 size={18} aria-hidden="true" />
                </Btn>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-3">
              {options.map((o, j) => {
                const I = ICONS[o.icon] ?? CircleHelp;
                const mine = picked === o.id;
                const state = picked === null ? '' : o.id === q.answer && right ? 'quiz-right' : mine ? 'quiz-wrong' : 'quiz-dim';
                return (
                  <button
                    type="button"
                    key={o.id}
                    data-testid={`quiz-option-${o.id}`}
                    data-picked={mine ? (o.id === q.answer ? 'right' : 'wrong') : undefined}
                    disabled={picked !== null}
                    className={`abtn choice flex min-h-14 flex-row items-center gap-2 text-left min-[520px]:flex-col min-[520px]:items-start ${state}`}
                    onClick={() => choose(o.id)}
                  >
                    <I size={28} aria-hidden="true" className="shrink-0" />
                    <span className="text-base font-bold leading-tight">{tr(o.text.key, o.text.vars)}</span>
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <div className="flex flex-col gap-2" data-testid="quiz-feedback" data-result={right ? 'right' : 'wrong'} aria-live="polite">
                <p className={`flex items-center gap-2 text-lg font-bold ${right ? 'text-good' : 'text-alert'}`}>
                  {right ? <CircleCheck size={24} aria-hidden="true" /> : <CircleAlert size={24} aria-hidden="true" />}
                  {tr(right ? 'quiz.ui.right' : 'quiz.ui.wrong')}
                </p>
                <p className="text-base leading-snug text-white/90">
                  {tr(q.why.key, q.why.vars)}
                  {q.label && <Mark label={q.label} tr={tr} />}
                </p>
                {/* the instrument or document behind a real number (a game rule needs only its mark) */}
                {q.source && q.label !== 'rule' && <p className="text-xs text-white/55">{tr(q.source)}</p>}
                {right ? (
                  <Btn data-testid="quiz-next" className="primary big w-full" onClick={next} autoFocus>
                    {tr('quiz.ui.next')}
                    <ArrowRight size={20} aria-hidden="true" />
                  </Btn>
                ) : (
                  <Btn data-testid="quiz-retry" className="solid big w-full" onClick={retry} autoFocus>
                    <RotateCcw size={20} aria-hidden="true" />
                    {tr('quiz.ui.retry')}
                  </Btn>
                )}
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
