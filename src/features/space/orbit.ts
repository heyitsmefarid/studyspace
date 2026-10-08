export type OrbitStatus = 'running' | 'paused' | 'ended';
export interface Orbit { id: string; by: string; durationMs: number; status: OrbitStatus; endsAt: number | null; remainingMs: number }
export type OrbitMessage =
  | { type: 'hello' }
  | { type: 'start'; orbitId: string; by: string; durationMs: number; remainingMs: number }
  | { type: 'pause' | 'resume' | 'end'; orbitId: string; remainingMs: number }
  | { type: 'sync'; orbitId: string; by: string; durationMs: number; status: OrbitStatus; remainingMs: number };

const anchored = (status: OrbitStatus, remainingMs: number, receivedAt: number) =>
  ({ status, remainingMs, endsAt: status === 'running' ? receivedAt + remainingMs : null });

export const orbitRemaining = (o: Orbit, now: number) =>
  (o.status === 'running' && o.endsAt !== null ? Math.max(0, o.endsAt - now) : o.remainingMs);

export const isOver = (o: Orbit, now: number) => o.status === 'ended' || (o.status === 'running' && orbitRemaining(o, now) === 0);

/**
 * Applies a message (local or from the partner) received at `receivedAt` on this device's clock. Every message carries
 * the remaining time at send, so devices with different clocks agree. Stale orbit ids are ignored; of two simultaneous
 * starts the lexicographically smaller id wins on both sides.
 */
export function orbitReducer(o: Orbit | null, m: OrbitMessage, receivedAt: number): Orbit | null {
  switch (m.type) {
    case 'hello':
      return o;
    case 'start':
      if (o && !isOver(o, receivedAt) && o.id <= m.orbitId) return o;
      return { id: m.orbitId, by: m.by, durationMs: m.durationMs, ...anchored('running', m.remainingMs, receivedAt) };
    case 'sync':
      // an over orbit (ended or timed out) never wins arbitration, and a sync that is already over never replaces a live one
      if (o && !isOver(o, receivedAt) && (o.id < m.orbitId || m.status === 'ended' || (m.status === 'running' && m.remainingMs === 0))) return o;
      return { id: m.orbitId, by: m.by, durationMs: m.durationMs, ...anchored(m.status, m.remainingMs, receivedAt) };
    default: {
      if (!o || o.id !== m.orbitId || o.status === 'ended') return o;
      const status: OrbitStatus = m.type === 'pause' ? 'paused' : m.type === 'resume' ? 'running' : 'ended';
      return { ...o, ...anchored(status, m.type === 'end' ? 0 : m.remainingMs, receivedAt) };
    }
  }
}

export const toSync = (o: Orbit, now: number): OrbitMessage =>
  ({ type: 'sync', orbitId: o.id, by: o.by, durationMs: o.durationMs, status: o.status, remainingMs: orbitRemaining(o, now) });

const MAX_MS = 4 * 3_600_000;
const isMs = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_MS;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

/** Validates a broadcast payload from the partner; anything unexpected is dropped. */
export function parseOrbitMessage(p: unknown): OrbitMessage | null {
  if (!p || typeof p !== 'object') return null;
  const m = p as Record<string, unknown>;
  switch (m.type) {
    case 'hello':
      return { type: 'hello' };
    case 'start':
      return isId(m.orbitId) && isId(m.by) && isMs(m.durationMs) && isMs(m.remainingMs)
        ? { type: 'start', orbitId: m.orbitId, by: m.by, durationMs: m.durationMs, remainingMs: m.remainingMs } : null;
    case 'pause': case 'resume': case 'end':
      return isId(m.orbitId) && isMs(m.remainingMs) ? { type: m.type as 'pause' | 'resume' | 'end', orbitId: m.orbitId, remainingMs: m.remainingMs } : null;
    case 'sync':
      return isId(m.orbitId) && isId(m.by) && isMs(m.durationMs) && isMs(m.remainingMs) && (m.status === 'running' || m.status === 'paused' || m.status === 'ended')
        ? { type: 'sync', orbitId: m.orbitId, by: m.by, durationMs: m.durationMs, status: m.status, remainingMs: m.remainingMs } : null;
    default:
      return null;
  }
}
