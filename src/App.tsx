import { useEffect, useMemo, useReducer, useState } from 'react';
import { Stage } from './scene/Stage';
import { Hud } from './ui/Hud';
import { FIRST_WEEK, initialModel, reducer, toView, type Machine, type Model, type View } from './state/game';
import { SKY, WEEKS, pickWeek } from './engine/week';
import type { Lang } from './i18n/t';
import { audio } from './audio/audio';
import { load, save } from './lib/storage';
import { features } from './config/features';
import { flush } from './net/api';

// Dev and shot.sh only: ?view={"plant":4,"wall":2} overrides the view so the scene can be checked without playing.
const params = new URLSearchParams(location.search);
const viewOverride: Partial<View> | null = (() => {
  if (!(import.meta.env.DEV || params.has('shot')) || !params.has('view')) return null;
  try {
    return JSON.parse(params.get('view')!) as Partial<View>;
  } catch {
    return null;
  }
})();

/** Saved game: the model without the week (looked up again by id), so old saves survive a new weeks.json. */
type Saved = Omit<Model, 'week'> & { weekId: string };

function loadSaved(): Model | null {
  const s = load<Saved | null>('game', null);
  const week = s ? WEEKS.find((w) => w.id === s.weekId) : undefined;
  if (!s || !week || !s.game || s.screen !== 'game') return null;
  const { weekId: _, ...rest } = s;
  return { ...rest, week };
}

/** First mission is always 25–31 Oct 2021 (final version); a class code (?week=) wins; later a random real week. */
function chooseWeek() {
  const played = load<boolean>('played', false);
  if (!params.has('week') && !played) return WEEKS.find((w) => w.id === FIRST_WEEK) ?? pickWeek(WEEKS, location.search);
  return pickWeek(WEEKS, location.search);
}

export function App() {
  const [model, dispatch] = useReducer(reducer, initialModel);
  const [lang, setLangState] = useState<Lang>(() => load<Lang>('lang', 'en'));
  const [sound, setSound] = useState(true);
  const [saved, setSaved] = useState<Model | null>(loadSaved);

  const view = useMemo(() => ({ ...toView(model, SKY), ...viewOverride }), [model]);

  useEffect(() => audio.setMuted(!sound), [sound]);
  useEffect(() => {
    if (features.sendResults) void flush();
  }, []);

  // A closed tab continues from the same day (developer guide §05). Saving may fail; the game goes on.
  useEffect(() => {
    if (model.screen === 'game' && model.week) {
      const { week, ...rest } = model;
      save('game', { ...rest, weekId: week.id } satisfies Saved);
    }
    if (model.phase === 'truth') save('played', true);
    if (model.screen === 'end') {
      save('game', null);
      setSaved(null);
    }
  }, [model]);

  const setLang = (l: Lang) => {
    setLangState(l);
    save('lang', l);
  };
  const onTap = (k: Machine) => dispatch({ type: 'SET', k });
  const onUndo = (k: Machine) => dispatch({ type: 'SET', k, delta: -1 });
  const onStart = () => {
    const week = chooseWeek();
    if (!week) return;
    // The seed only shuffles the day cards; it is drawn here, outside the pure engine and reducer.
    dispatch({ type: 'START', week, seed: Math.floor(Math.random() * 2 ** 31) });
    setSaved(null);
  };
  const onContinue = saved ? () => dispatch({ type: 'RESUME', model: saved }) : undefined;

  return (
    <>
      <Stage view={view} onTap={onTap} onUndo={features.controls ? onUndo : undefined} />
      <Hud
        model={model}
        view={view}
        dispatch={dispatch}
        lang={lang}
        setLang={setLang}
        sound={sound}
        setSound={setSound}
        onStart={onStart}
        onContinue={model.screen === 'game' ? undefined : onContinue}
      />
      {import.meta.env.DEV && !WEEKS.length && (
        <div className="fixed bottom-2 right-2 rounded bg-yellow-400 px-2 py-1 text-sm text-black">src/engine/weeks.json is missing</div>
      )}
    </>
  );
}
