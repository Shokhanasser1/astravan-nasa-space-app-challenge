import { features } from '../config/features';

/**
 * Free walking is on when its flag is (src/config/features.ts), or for one visit with `?walk` in the address:
 * the six standing points and the tap-to-float markers stay, and W A S D, the arrows or the touch stick walk.
 */
export const freeWalk: boolean = features.freeWalk || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('walk'));
