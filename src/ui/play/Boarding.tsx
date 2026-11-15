import { useEffect, useState } from 'react';
import { Rocket, TriangleAlert } from 'lucide-react';
import { BOARD_S } from '../../scene/boarding';
import type { LaunchWarning } from '../../state/launch';
import type { Tr } from './kit';

/**
 * Day 7 in the home story (features.homeStory; the lead's document pp. 12, 14, 17). Words only, numbers from the
 * state (src/state/launch.ts) and the scene's boarding time (src/scene/boarding.ts).
 */

/** Over the launch button: the warning of the first press ("The ship is only 40% ready"), and that a second goes on. */
export function LaunchWarningNote({ warning, tr }: { warning: LaunchWarning; tr: Tr }) {
  const notReady = warning.key === 'ui.launch.notReady';
  return (
    <p
      className="holo holo-in pointer-events-none flex items-start gap-2 rounded-[16px] px-3 py-2 text-sm font-semibold leading-snug"
      role="alert"
      data-testid="launch-warning"
      data-warning={warning.key}
    >
      <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-alert" />
      <span>
        {notReady ? tr(warning.key, { n: warning.n }) : tr(warning.key)}{' '}
        <span className="font-normal opacity-80">{tr(notReady ? 'ui.launch.again' : 'ui.launch.goOn')}</span>
      </span>
    </p>
  );
}

/** While the astronaut climbs aboard: "Climbing aboard. Liftoff in n", then "Liftoff!" as the engine lights. */
export function BoardingCountdown({ tr }: { tr: Tr }) {
  const [left, setLeft] = useState(Math.ceil(BOARD_S));
  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const n = Math.ceil(BOARD_S - (performance.now() - t0) / 1000);
      setLeft(Math.max(0, n));
      if (n <= 0) window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p
      className="holo holo-in pointer-events-none flex items-center justify-center gap-2 self-center rounded-[16px] px-4 py-2 text-lg font-bold tabular-nums"
      role="status"
      aria-live="polite"
      data-testid="launch-countdown"
      data-left={left}
    >
      <Rocket size={20} aria-hidden="true" className="shrink-0 text-accent" />
      {left > 0 ? tr('ui.launch.countdown', { n: left }) : tr('ui.launch.liftoff')}
    </p>
  );
}
