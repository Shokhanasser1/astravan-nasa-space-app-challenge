import { useEffect, useState } from 'react';
import { Stage } from './scene/Stage';
import { Hud } from './hud/Hud';
import { useGame } from './state/store';
import { loadSky, loadWeeks, pickWeek } from './data/load';
import { audio } from './audio/audio';
import { flush } from './net/api';

export function App() {
  const setData = useGame((s) => s.setData);
  const sound = useGame((s) => s.settings.sound);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadWeeks(), loadSky()])
      .then(([weeks, sky]) => setData(pickWeek(weeks.weeks, location.search), sky))
      .catch((e: Error) => {
        // weeks.json not in the repo yet: keep the game clickable with an empty week, and say so in dev.
        setDataError(e.message);
        setData({ id: '2021-10-25', kind: 'storm', days: [] }, null);
      });
    void flush();
  }, [setData]);

  useEffect(() => audio.setMuted(!sound), [sound]);

  return (
    <>
      <Stage />
      <Hud />
      {import.meta.env.DEV && dataError && (
        <div className="fixed bottom-2 left-2 rounded bg-yellow-400 px-2 py-1 text-sm text-black">
          public/data/weeks.json: {dataError}
        </div>
      )}
    </>
  );
}
