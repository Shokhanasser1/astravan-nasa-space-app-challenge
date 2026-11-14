import { useEffect, useMemo, useReducer, useState } from 'react';
import { Stage } from './scene/Stage';
import { Hud } from './ui/Hud';
import { initialModel, reducer, toView, type Machine, type View } from './state/game';
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

export function App() {
  const [model, dispatch] = useReducer(reducer, initialModel);
  const [lang, setLangState] = useState<Lang>(() => load<Lang>('lang', 'en'));
  const [sound, setSound] = useState(true);

  const view = useMemo(() => ({ ...toView(model, SKY), ...viewOverride }), [model]);
  const week = useMemo(() => pickWeek(WEEKS, location.search), []);

  useEffect(() => audio.setMuted(!sound), [sound]);
  useEffect(() => {
    if (features.sendResults) void flush();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    save('lang', l);
  };
  const onTap = (k: Machine) => dispatch({ type: 'SET', k });
  // Until weeks.json is in src/engine/, start on an empty week so the loop stays playable.
  const onStart = () => dispatch({ type: 'START', week: week ?? { id: '2021-10-25', days: [] } });

  return (
    <>
      <Stage view={view} onTap={onTap} />
      <Hud model={model} view={view} dispatch={dispatch} lang={lang} setLang={setLang} sound={sound} setSound={setSound} onStart={onStart} />
      {import.meta.env.DEV && !WEEKS.length && (
        <div className="fixed bottom-2 right-2 rounded bg-yellow-400 px-2 py-1 text-sm text-black">src/engine/weeks.json is missing</div>
      )}
    </>
  );
}
