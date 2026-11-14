import { features } from '../../config/features';

/**
 * NASA-based buildings are on when their flag is (src/config/features.ts), or for one visit with `?models` in the
 * address. Off: the grey code shapes, exactly as before (no model is requested).
 */
export const nasaModels: boolean =
  features.nasaModels || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('models'));
