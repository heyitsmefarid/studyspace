import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './motion';

/** Ease-out-cubic count from `from` (default 0) to `target`; exact at the end. */
export function countUpValue(target: number, elapsedMs: number, durationMs: number, from = 0): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return target;
  const k = Math.max(0, elapsedMs) / durationMs;
  return Math.round(from + (target - from) * (1 - (1 - k) ** 3));
}

/** Counts up to `target`; when the target changes later, it counts on from the number currently shown. */
export function useCountUp(target: number, durationMs = 900): number {
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const duration = prefersReducedMotion() ? 0 : durationMs;
    const from = current.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const v = countUpValue(target, t - t0, duration, from);
      current.current = v;
      setShown(v);
      if (v !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return shown;
}
