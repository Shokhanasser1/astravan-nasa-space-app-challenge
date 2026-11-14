import type { Dispatch } from 'react';
import type { Action, Model, View } from '../state/game';
import { t, type Lang } from '../i18n/t';
import { audio } from '../audio/audio';

/**
 * Lane D (Shoxjahon aka). DOM layer above the Canvas: gauges, labels, four modals, truth screen, language.
 * PLACEHOLDER wiring so the whole loop is playable today; replace with Hud, Labels, CardModal, AlertModal,
 * MorningReport, NightLog, Truth, Curve. Rules: every button shows its price before it is pressed (model.preview);
 * ≤ 8 words per instruction; tap targets ≥ 48 px; fits 360×640; no Uzbek text overflows.
 * 3D labels: DOM elements positioned by camera projection (skeleton's Project), not drei <Html>.
 */
const LANGS: Lang[] = ['en', 'uz', 'ru'];

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { active, className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`min-h-12 min-w-12 rounded-xl px-4 py-2 font-semibold ${active ? 'bg-white text-black' : 'bg-white/10 text-white'} active:scale-95 ${className}`}
    />
  );
}

interface Props {
  model: Model;
  view: View;
  dispatch: Dispatch<Action>;
  lang: Lang;
  setLang: (l: Lang) => void;
  sound: boolean;
  setSound: (s: boolean) => void;
  onStart: () => void;
}

export function Hud({ model, view, dispatch, lang, setLang, sound, setSound, onStart }: Props) {
  const tr = (k: string, v?: Record<string, string | number>) => t(lang, k, v);
  const primary =
    view.phase === 'plan'
      ? { label: tr('ui.board.confirmDay'), action: { type: 'CONFIRM' } as const }
      : { label: tr('ui.hud.next'), action: { type: 'NEXT' } as const };

  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col justify-between p-4" onPointerDown={() => audio.unlock()}>
      <div className="pointer-events-auto flex gap-2 self-end">
        {LANGS.map((l) => (
          <Btn key={l} active={lang === l} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </Btn>
        ))}
        <Btn active={sound} onClick={() => setSound(!sound)} aria-label={tr('ui.hud.sound')}>
          ♪
        </Btn>
      </div>

      {model.screen === 'start' && (
        <div className="pointer-events-auto flex flex-col items-center gap-4 self-center">
          <Btn onClick={onStart}>{tr('ui.start.mission')}</Btn>
        </div>
      )}

      {model.screen === 'game' && view.phase !== 'truth' && (
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <span className="text-lg" data-phase={view.phase}>
            {tr('ui.hud.dayOf', { day: view.day, total: 7 })} · {view.phase}
          </span>
          <Btn onClick={() => dispatch(primary.action)}>{primary.label}</Btn>
        </div>
      )}

      {model.screen === 'game' && view.phase === 'truth' && (
        <div className="pointer-events-auto flex flex-col items-center gap-4 self-center">
          <span className="text-2xl">{model.week?.id}</span>
          <Btn onClick={() => dispatch({ type: 'NEXT' })}>{tr('ui.end.again')}</Btn>
        </div>
      )}
    </div>
  );
}
