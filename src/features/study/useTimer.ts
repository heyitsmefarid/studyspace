import { useEffect, useState } from 'react';
import type { TimerAction } from './timer';

/** Re-renders every second and ticks the timer; also catches up when the tab becomes visible again. */
export function useTimer(dispatch: (a: TimerAction) => void, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    };
    const id = setInterval(tick, 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [dispatch, enabled]);
  return now;
}
