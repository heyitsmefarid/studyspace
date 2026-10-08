import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { backoffMs, partnerPresence, type MyStatus, type PartnerPresence, type PresenceMeta } from './presence';

export type RoomEvent = 'typing' | 'orbit';
export type LiveTable = 'messages' | 'message_reactions' | 'notifications' | 'study_sessions';
export type RowChange = RealtimePostgresChangesPayload<Record<string, unknown>>;
export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';
type Payload = Record<string, unknown>;

interface RealtimeValue {
  status: ConnectionStatus;
  partner: PartnerPresence;
  setMyStatus: (s: MyStatus) => void;
  send: (event: RoomEvent, payload: Payload) => void;
  onEvent: (event: RoomEvent, handler: (payload: Payload) => void) => () => void;
  onTable: (table: LiveTable, handler: (change: RowChange) => void) => () => void;
}

const noop = () => {};
const RealtimeContext = createContext<RealtimeValue>({
  status: 'connecting', partner: { state: 'offline' }, setMyStatus: noop, send: noop, onEvent: () => noop, onTable: () => noop,
});
export const useRealtime = () => useContext(RealtimeContext);

const TABLES: LiveTable[] = ['messages', 'message_reactions', 'notifications', 'study_sessions'];
/** Refreshed after a dropped connection comes back: events may have been missed meanwhile. */
const RESYNC_KEYS = [['chat'], ['notifications'], ['space'], ['sessions']];

/** The seeded shared room ("Our Room"); one per StudySpace. */
export function useOurRoom() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['our-room'],
    enabled: Boolean(user),
    staleTime: Infinity,
    queryFn: async () => unwrap(await supabase.from('study_rooms').select('id').order('created_at').limit(1).single()).id,
  });
}

function createHub<K, P>() {
  const map = new Map<K, Set<(p: P) => void>>();
  return {
    on: (key: K, handler: (p: P) => void) => {
      const set = map.get(key) ?? new Set<(p: P) => void>();
      set.add(handler);
      map.set(key, set);
      return () => { set.delete(handler); };
    },
    emit: (key: K, p: P) => { map.get(key)?.forEach((h) => h(p)); },
  };
}

/**
 * One private channel `room:<id>` per signed-in session: Presence (online / studying), Broadcast (typing, orbit) and
 * Postgres Changes for the live tables. Reconnects with backoff and refreshes live queries after a drop.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, partner, preferences } = useAuth();
  const qc = useQueryClient();
  const roomId = useOurRoom().data ?? null;
  const uid = user?.id;
  const showOnline = preferences.privacy.showOnline;
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [presence, setPresence] = useState<Record<string, PresenceMeta[]>>({});
  const [events] = useState(() => createHub<RoomEvent, Payload>());
  const [tables] = useState(() => createHub<LiveTable, RowChange>());
  const channel = useRef<RealtimeChannel | null>(null);
  const live = useRef(false);
  const myStatus = useRef<MyStatus>({ status: 'online' });

  const track = useRef(() => {});
  useEffect(() => {
    track.current = () => {
      const ch = channel.current;
      if (!ch || !live.current || !uid) return;
      if (showOnline) void ch.track({ userId: uid, ...myStatus.current });
      else void ch.untrack();
    };
    track.current();
  }, [uid, showOnline]);

  useEffect(() => {
    if (!uid || !roomId) return;
    let disposed = false;
    let attempt = 0;
    let needsResync = true; // the first connect also refreshes: rows may have arrived before the channel was live
    let retry: number | undefined;
    const connect = () => {
      const ch = supabase.channel(`room:${roomId}`, { config: { private: true, presence: { key: uid } } });
      channel.current = ch;
      ch.on('presence', { event: 'sync' }, () => setPresence({ ...ch.presenceState<PresenceMeta>() }));
      ch.on('broadcast', { event: '*' }, ({ event, payload }) => events.emit(event as RoomEvent, (payload ?? {}) as Payload));
      for (const table of TABLES) {
        const config = table === 'notifications'
          ? { event: '*' as const, schema: 'public', table, filter: `user_id=eq.${uid}` }
          : { event: '*' as const, schema: 'public', table };
        ch.on('postgres_changes', config, (change: RowChange) => tables.emit(table, change));
      }
      ch.subscribe((s) => {
        if (disposed || channel.current !== ch) return;
        if (s === 'SUBSCRIBED') {
          live.current = true;
          attempt = 0;
          setStatus('live');
          if (needsResync) {
            needsResync = false;
            for (const queryKey of RESYNC_KEYS) void qc.invalidateQueries({ queryKey });
          }
          track.current();
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          live.current = false;
          needsResync = true;
          setStatus('reconnecting');
          setPresence({});
          channel.current = null;
          void supabase.removeChannel(ch);
          retry = window.setTimeout(connect, backoffMs(attempt++));
        }
      });
    };
    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retry);
      live.current = false;
      const ch = channel.current;
      channel.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [uid, roomId, qc, events, tables]);

  // Stable identities: effects that depend on them (e.g. the orbit "hello" after connecting) must not re-run on every presence change.
  const send = useCallback((event: RoomEvent, payload: Payload) => {
    const ch = channel.current;
    if (ch && live.current) void ch.send({ type: 'broadcast', event, payload });
  }, []);
  const setMyStatus = useCallback((s: MyStatus) => { myStatus.current = s; track.current(); }, []);

  const value = useMemo<RealtimeValue>(() => ({
    status,
    partner: partnerPresence(presence, partner?.id),
    setMyStatus,
    send,
    onEvent: events.on,
    onTable: tables.on,
  }), [status, presence, partner?.id, setMyStatus, send, events, tables]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
