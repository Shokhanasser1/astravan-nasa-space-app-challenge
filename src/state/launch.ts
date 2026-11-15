/**
 * Day 7's launch button (home story, features.homeStory; the lead's document p. 12 "Tayyor bo'lmagan kema" and
 * p. 14): the ship flies below 100 % (an engine rule, kept for the hackathon), but the child is told first. The
 * first press on "Launch!" shows the warning on the button; the second press goes on — the child decides.
 *   · fewer than 4 batteries on the ship → the engine's own `engine.warn.noLaunch` (going on = Late Ride Home)
 *   · charged, but the ship below 100 % after today's rover runs → "The ship is only {n}% ready"
 * Pure: reads the model and the engine's preview; computes no game number of its own (Ship % is game.ts shipPct).
 */
import { P, sciTarget } from '../engine/rules';
import { shipPct, type Model } from './game';

export type LaunchWarning = { key: 'engine.warn.noLaunch' } | { key: 'ui.launch.notReady'; n: number };

/** The warning the launch button would show now; null when the ship is charged and 100 % ready (or not Day 7's plan). */
export function launchWarning(m: Model): LaunchWarning | null {
  const g = m.game;
  // (a backup-tank day runs itself: nothing for the child to decide)
  if (m.phase !== 'plan' || !g || !m.week || g.day !== 7 || g.forced) return null;
  if (m.alloc.launch < P.launchCost) return { key: 'engine.warn.noLaunch' };
  // the ship as it lifts off: the parts the last rover runs bring today count too
  const n = shipPct(g.sci + (m.preview?.sciToday ?? 0), sciTarget(m.week));
  return n < 100 ? { key: 'ui.launch.notReady', n } : null;
}

/** One warning's identity: a new number or a new kind is a new warning (it is shown again before going on). */
export const warningId = (w: LaunchWarning | null): string | null => (w ? (w.key === 'ui.launch.notReady' ? `${w.key}:${w.n}` : w.key) : null);

/**
 * A press on the launch button: `shown` is the warning already on the button (its id), `now` the one the plan has.
 * Returns `go` (confirm the day) or the warning to show; a press after the same warning was shown goes on.
 */
export function pressLaunch(shown: string | null, now: LaunchWarning | null): { go: true } | { go: false; show: string } {
  const id = warningId(now);
  return id === null || id === shown ? { go: true } : { go: false, show: id };
}
