import { useEffect, useState } from 'react';
import { Watch } from 'lucide-react';
import type { Tr } from './kit';
import './crash-intro.css';

/**
 * Home story T2, the first seconds of Day 1 at the crash site (the document p. 6, scene 1): a black screen with
 * "IMPACT · SIGNAL LOST", the helmet lamp flickers on and the crash site appears, the wrist reads "AIR: 7 DAYS".
 * ~3.2 s, once per game, never in the way: nothing in it takes a pointer, so Next, the stick and the map work at
 * once (the e2e week presses Next under it). Words only through keys; the 7 days are the mission's (game rule: the
 * mothership waits seven days), as on the day badge.
 */
const MS = 3200;
const DAYS = 7;

export function CrashIntro({ seed, tr }: { seed: number; tr: Tr }) {
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setDone(seed), MS);
    return () => window.clearTimeout(id);
  }, [seed]);
  if (done === seed) return null;
  return (
    <div className="crash-intro" data-testid="crash-intro" aria-live="polite">
      <div className="crash-intro__black" />
      <div className="crash-intro__lamp" />
      <p className="crash-intro__impact">{tr('ui.crash.impact')}</p>
      <div className="crash-intro__wrist holo rounded-[16px]">
        <Watch size={20} aria-hidden="true" className="crash-intro__icon" />
        <span className="crash-intro__air">{tr('ui.crash.air', { n: DAYS })}</span>
        <span className="crash-intro__tag">{tr('ui.label.rule')}</span>
      </div>
    </div>
  );
}
