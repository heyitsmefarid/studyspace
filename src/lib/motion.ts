import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  return Boolean(win?.matchMedia?.(QUERY).matches);
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** Live reduced-motion preference for JS-driven motion (Recharts, count-ups, canvas). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => prefersReducedMotion(), () => false);
}
