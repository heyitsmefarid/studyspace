import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './motion';

/** Ease-out-cubic count from 0 to `target`; exact at the end. */
export function countUpValue(target: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return target;
  const k = Math.max(0, elapsedMs) / durationMs;
  return Math.round(target * (1 - (1 - k) ** 3));
}

export function useCountUp(target: number, durationMs = 900): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const duration = prefersReducedMotion() ? 0 : durationMs;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const v = countUpValue(target, t - t0, duration);
      setShown(v);
      if (v !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return shown;
}
