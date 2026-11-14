import { useGame, type Lang } from '../state/store';
import { useT } from '../i18n';
import { audio } from '../audio/audio';
import type { Level } from '../engine/types';

/**
 * DOM layer over the canvas. Owner: Shoxjahon aka. These are wiring placeholders for G1/G2:
 * replace each block with the real screen (report, guess, card, energy board, night log, truth sequence).
 * Rules: price before choice; undo until "Confirm day"; ≤ 8 words per instruction; tap targets ≥ 48 px.
 */
const LANGS: Lang[] = ['en', 'uz', 'ru'];
const LEVELS: Level[] = ['cadet', 'pilot', 'commander'];

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { active, className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`min-h-12 min-w-12 rounded-xl px-4 py-2 text-base font-semibold ${
        active ? 'bg-white text-black' : 'bg-white/10 text-white'
      } active:scale-95 ${className}`}
    />
  );
}

export function Hud() {
  const t = useT();
  const { screen, settings, game, week, setSettings, newGame, confirmDay, go } = useGame();

  return (
    <div
      className="pointer-events-none fixed inset-0 flex flex-col justify-between p-4"
      onPointerDown={() => audio.unlock()}
    >
      <div className="pointer-events-auto flex gap-2 self-end">
        {LANGS.map((l) => (
          <Btn key={l} active={settings.lang === l} onClick={() => setSettings({ lang: l })}>
            {l.toUpperCase()}
          </Btn>
        ))}
        <Btn active={settings.sound} onClick={() => setSettings({ sound: !settings.sound })} aria-label={t('hud.sound')}>
          ♪
        </Btn>
      </div>

      {screen === 'title' && (
        <div className="pointer-events-auto flex flex-col items-center gap-4 self-center">
          <div className="flex gap-2">
            {LEVELS.map((lv) => (
              <Btn key={lv} active={settings.level === lv} onClick={() => setSettings({ level: lv })}>
                {t(`level.${lv}`)}
              </Btn>
            ))}
          </div>
          <Btn onClick={() => newGame()}>{t('title.start')}</Btn>
        </div>
      )}

      {screen === 'day' && game && (
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <span className="text-lg">{t('hud.dayOf', { day: game.day, total: 7 })}</span>
          <Btn onClick={() => confirmDay()}>{t('board.confirmDay')}</Btn>
        </div>
      )}

      {screen === 'truth' && (
        <div className="pointer-events-auto flex flex-col items-center gap-4 self-center">
          <span className="text-2xl">{week?.id}</span>
          <Btn onClick={() => go('title')}>{t('end.again')}</Btn>
        </div>
      )}
    </div>
  );
}
