import type { Quality } from '../state/store';

/** Render budgets per tier. PerformanceMonitor steps down when FPS drops; settings can force a tier. */
export const QUALITY: Record<Quality, { dpr: [number, number]; shadow: number; bloom: boolean; dust: number }> = {
  high: { dpr: [1, 1.5], shadow: 2048, bloom: true, dust: 3000 },
  medium: { dpr: [1, 1.25], shadow: 1024, bloom: true, dust: 1500 },
  low: { dpr: [0.75, 1], shadow: 512, bloom: false, dust: 500 },
};

export const LOWER: Record<Quality, Quality> = { high: 'medium', medium: 'low', low: 'low' };
