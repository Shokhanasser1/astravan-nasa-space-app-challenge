/**
 * "A drop is noticed" (home story; the lead's document p. 6, "Xatoni sezmaydi", and p. 12, the mistakes table): while
 * a day is planned, the engine's preview tells whether the air runs out tonight or the food falls. The HUD turns
 * that gauge to its warning look, and the first press of "Start the day" with such a drop pending lets Houston say it
 * once on the radio; a second press starts the day anyway (the child decides). Pure: reads the model and the
 * engine's preview, computes no game number.
 */
import type { Model } from './game';

export interface Nudge {
  /** The radio line Houston says once (story.radio.*). */
  key: string;
  gauge: 'air' | 'food';
}

export function dropNudge(m: Model): Nudge | null {
  const g = m.game;
  const p = m.preview;
  if (m.phase !== 'plan' || !g || !p || g.forced || g.day > 7) return null;
  if (p.reserveAfter <= 0) return { key: 'story.radio.needAir', gauge: 'air' };
  // (Day 7's food changes nothing: the harvest was counted on Day 6.)
  if (g.day < 7 && p.gardenAfter < g.plant) return { key: 'story.radio.needLight', gauge: 'food' };
  return null;
}
