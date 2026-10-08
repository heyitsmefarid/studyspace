import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useConnection, useRoomEvent, useSendRoomEvent } from '@/features/realtime/useRealtime';
import { isOver, orbitReducer, orbitRemaining, parseOrbitMessage, toSync, type Orbit, type OrbitMessage } from './orbit';

let current: Orbit | null = null;
const listeners = new Set<() => void>();
function set(next: Orbit | null) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The shared orbit (study-together timer) and the actions that change it for both members. */
export function useOrbit() {
  const orbit = useSyncExternalStore(subscribe, () => current, () => null);
  const send = useSendRoomEvent();
  const { user } = useAuth();
  const act = useCallback((m: OrbitMessage) => {
    set(orbitReducer(current, m, Date.now()));
    send('orbit', { ...m });
  }, [send]);
  const start = useCallback((durationMs: number) => {
    const orbitId = crypto.randomUUID();
    act({ type: 'start', orbitId, by: user!.id, durationMs, remainingMs: durationMs });
    return orbitId;
  }, [act, user]);
  const control = useCallback((type: 'pause' | 'resume' | 'end') => {
    if (current) act({ type, orbitId: current.id, remainingMs: orbitRemaining(current, Date.now()) });
  }, [act]);
  return { orbit, start, pause: () => control('pause'), resume: () => control('resume'), end: () => control('end') };
}

/** Mounted once: applies the partner's orbit messages, answers late joiners, and asks for the state after (re)connecting. */
export function useOrbitSync() {
  const send = useSendRoomEvent();
  const status = useConnection();
  useRoomEvent('orbit', (payload) => {
    const m = parseOrbitMessage(payload);
    if (!m) return;
    if (m.type === 'hello') {
      if (current && !isOver(current, Date.now())) send('orbit', { ...toSync(current, Date.now()) });
      return;
    }
    set(orbitReducer(current, m, Date.now()));
  });
  useEffect(() => { if (status === 'live') send('orbit', { type: 'hello' }); }, [status, send]);
}
