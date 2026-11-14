import type { Action, Board, Machine, Model } from '../state/game';
import type { PointId } from '../scene/points';
import type { Command } from './keys';

/**
 * What a command does right now. Pure: the same rules serve the keyboard and the touch buttons, and they are
 * tested without a browser. It never computes a game number: it only picks which existing action to dispatch
 * (SET, CHOOSE, CONFIRM, NEXT) or which window of the HUD to open.
 */
export type Overlay = 'map' | 'help' | null;
export type UiOp = 'tablet' | 'map' | 'help' | 'close' | 'houston';

export interface Ctx {
  screen: Model['screen'];
  phase: Model['phase'];
  board: Board | null;
  /** The building in front of the astronaut (src/controls/bus.ts), or null. */
  aim: Machine | null;
  overlay: Overlay;
}

export type Effect = { action: Action } | { ui: UiOp } | { travel: PointId };

/** The base map, in the order of its number keys: the six standing points, then inside the habitat. */
export const TRAVEL: PointId[] = ['airlock', 'hub', 'garden', 'workshop', 'hill', 'ladder', 'inside'];

/** Card answers first, then shelter choices: the same order and numbers as on the wrist tablet. */
export function choices(board: Board | null): Action[] {
  if (!board) return [];
  return [
    ...board.cardOptions.map((o): Action => ({ type: 'CHOOSE', card: o.value })),
    ...board.shelterOptions.map((o): Action => ({ type: 'CHOOSE', shelter: o.value })),
  ];
}

/** The map can be opened while the astronaut stands on the ground (not during the launch or the truth sequence). */
export const canTravel = (c: Pick<Ctx, 'screen' | 'phase'>) => c.screen === 'game' && c.phase !== 'launch' && c.phase !== 'truth';

export function resolve(cmd: Command, c: Ctx): Effect | null {
  if (cmd.kind === 'help') return { ui: 'help' };
  if (cmd.kind === 'close') return c.overlay ? { ui: 'close' } : null;
  if (c.screen !== 'game') return null;

  // An open map takes the digits and Enter for itself.
  if (c.overlay === 'map') {
    if (cmd.kind === 'map') return { ui: 'close' };
    if (cmd.kind === 'pick' && cmd.n <= TRAVEL.length) return { travel: TRAVEL[cmd.n - 1] };
    return null;
  }
  if (c.overlay === 'help') return null;

  const plan = c.phase === 'plan' && c.board !== null;
  switch (cmd.kind) {
    case 'use':
      return plan && c.aim ? { action: { type: 'SET', k: c.aim } } : null;
    case 'undo':
      return plan && c.aim ? { action: { type: 'SET', k: c.aim, delta: -1 } } : null;
    case 'pick': {
      const list = plan ? choices(c.board) : [];
      return cmd.n <= list.length ? { action: list[cmd.n - 1] } : null;
    }
    case 'confirm':
      if (c.phase === 'plan') {
        // Same rule as the button: a day card needs an answer first.
        return c.board?.preview?.warning === 'engine.warn.chooseCard' ? null : { action: { type: 'CONFIRM' } };
      }
      return { action: { type: 'NEXT' } };
    case 'tablet':
      return plan ? { ui: 'tablet' } : null;
    case 'houston':
      return plan && c.board!.shelterOptions.length > 0 ? { ui: 'houston' } : null;
    case 'map':
      return canTravel(c) ? { ui: 'map' } : null;
  }
}
