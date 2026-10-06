const FADE_MS = 200;

/** Opacity multiplier for star `index` while the sky draws in: each star starts a little later and fades in over 200 ms. */
export function revealAlpha(index: number, count: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  const start = count > 1 ? (index / (count - 1)) * (durationMs - FADE_MS) : 0;
  return Math.min(1, Math.max(0, (elapsedMs - start) / FADE_MS));
}

/**
 * When the draw-in began: the first paint that has stars starts it, and later redraws (resize, theme, new data)
 * keep that start so the reveal carries on instead of restarting or being skipped.
 */
export function revealClock(start: number | null, enabled: boolean, hasStars: boolean, now: number): number | null {
  if (start !== null) return start;
  return enabled && hasStars ? now : null;
}
