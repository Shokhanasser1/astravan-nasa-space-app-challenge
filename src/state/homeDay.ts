/**
 * Where the astronaut is during the home story's day (Shoxjahon aka's document, 15 Nov: logic fixes p. 12, the day
 * order p. 14, "next in line" p. 18). Pure rules read by the View (src/state/game.ts toView), the rig and the HUD;
 * they decide no game number: the shelter and the backup-tank day are the engine's.
 *
 * - Inside all day: "Stay inside all day" on a storm day, and the backup-tank day (the engine plays it with the
 *   shelter full), the astronaut stays in the habitat and runs the base from the Plan list.
 * - Bedtime: once a day of Days 1–6 has run, the child puts the astronaut to bed — the Sleep button, or E at the
 *   habitat door. (Day 7 ends with the launch, not in bed.)
 */
import type { Shelter } from '../engine/rules';
import type { Phase } from './game';

/** The crew stays in the habitat today: planning or running a day whose shelter is full. */
export function indoorsToday(phase: Phase, shelter: Shelter): boolean {
  return (phase === 'plan' || phase === 'run') && shelter === 'full';
}

/** The day has run and waits for Sleep (`day` = the day just played, View.day). */
export function bedtime(phase: Phase, day: number): boolean {
  return phase === 'run' && day >= 1 && day <= 6;
}
