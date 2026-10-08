import { describe, expect, it } from 'vitest';
import { isOver, orbitReducer, orbitRemaining, parseOrbitMessage, toSync, type Orbit } from './orbit';

const MIN = 60_000;
const start = (orbitId: string, receivedAt = 0, remainingMs = 25 * MIN) =>
  orbitReducer(null, { type: 'start', orbitId, by: 'ana', durationMs: 25 * MIN, remainingMs }, receivedAt)!;

describe('orbitReducer', () => {
  it('starts running, anchored on the receiver’s clock', () => {
    // the sender's clock is irrelevant: only remainingMs travels, and this device anchors it on receipt
    const o = start('o1', 5000, 10 * MIN);
    expect(o).toMatchObject({ id: 'o1', status: 'running', endsAt: 5000 + 10 * MIN });
    expect(orbitRemaining(o, 5000 + MIN)).toBe(9 * MIN);
  });
  it('pauses and resumes for both members', () => {
    const paused = orbitReducer(start('o1'), { type: 'pause', orbitId: 'o1', remainingMs: 5 * MIN }, 1000)!;
    expect(paused).toMatchObject({ status: 'paused', endsAt: null, remainingMs: 5 * MIN });
    expect(orbitRemaining(paused, 99 * MIN)).toBe(5 * MIN);
    const resumed = orbitReducer(paused, { type: 'resume', orbitId: 'o1', remainingMs: 5 * MIN }, 2000)!;
    expect(resumed).toMatchObject({ status: 'running', endsAt: 2000 + 5 * MIN });
  });
  it('ignores messages for an old orbit', () => {
    const o = start('o2');
    expect(orbitReducer(o, { type: 'pause', orbitId: 'o1', remainingMs: 0 }, 1)).toBe(o);
  });
  it('lets the lexicographically smaller id win simultaneous starts on both devices', () => {
    const onA = orbitReducer(start('b-orbit'), { type: 'start', orbitId: 'a-orbit', by: 'ben', durationMs: 25 * MIN, remainingMs: 25 * MIN }, 10)!;
    const onB = orbitReducer(start('a-orbit'), { type: 'start', orbitId: 'b-orbit', by: 'ana', durationMs: 25 * MIN, remainingMs: 25 * MIN }, 10)!;
    expect(onA.id).toBe('a-orbit');
    expect(onB.id).toBe('a-orbit');
  });
  it('lets a start after a time-up orbit win regardless of id', () => {
    const msg = (orbitId: string) => ({ type: 'start' as const, orbitId, by: 'ben', durationMs: 25 * MIN, remainingMs: 25 * MIN });
    const timedUp = (id: string) => start(id, 0, MIN); // over from MIN onwards
    expect(orbitReducer(timedUp('z-old'), msg('a-new'), 2 * MIN)!.id).toBe('a-new');
    expect(orbitReducer(timedUp('a-old'), msg('z-new'), 2 * MIN)!.id).toBe('z-new');
  });
  it('does not let a stale sync for a time-up orbit replace a live one', () => {
    const live = start('m', 0, 25 * MIN);
    const stale = { type: 'sync' as const, orbitId: 'a', by: 'ben', durationMs: 25 * MIN, status: 'running' as const, remainingMs: 0 };
    expect(orbitReducer(live, stale, MIN)).toBe(live);
    expect(orbitReducer(live, { ...stale, status: 'ended' }, MIN)).toBe(live);
  });
  it('lets a late joiner adopt the current state from a sync', () => {
    const synced = orbitReducer(null, { type: 'sync', orbitId: 'o1', by: 'ana', durationMs: 25 * MIN, status: 'paused', remainingMs: 7 * MIN }, 100)!;
    expect(synced).toMatchObject({ id: 'o1', status: 'paused', remainingMs: 7 * MIN });
  });
  it('ends, and counts a running orbit whose time is up as over', () => {
    const ended = orbitReducer(start('o1'), { type: 'end', orbitId: 'o1', remainingMs: 3 * MIN }, 50)!;
    expect(ended.status).toBe('ended');
    expect(isOver(ended, 0)).toBe(true);
    expect(isOver(start('o1', 0, MIN), MIN)).toBe(true);
    expect(isOver(start('o1', 0, MIN), MIN - 1)).toBe(false);
  });
  it('round-trips the current state through a sync message', () => {
    const o: Orbit = start('o1', 0, 10 * MIN);
    expect(toSync(o, MIN)).toEqual({ type: 'sync', orbitId: 'o1', by: 'ana', durationMs: 25 * MIN, status: 'running', remainingMs: 9 * MIN });
  });
});

describe('parseOrbitMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parseOrbitMessage({ type: 'hello' })).toEqual({ type: 'hello' });
    expect(parseOrbitMessage({ type: 'pause', orbitId: 'o1', remainingMs: 1000 })).toEqual({ type: 'pause', orbitId: 'o1', remainingMs: 1000 });
  });
  it('drops anything malformed or absurd', () => {
    expect(parseOrbitMessage(null)).toBeNull();
    expect(parseOrbitMessage({ type: 'start', orbitId: 'o1', by: 'a', durationMs: -1, remainingMs: 0 })).toBeNull();
    expect(parseOrbitMessage({ type: 'start', orbitId: 'o1', by: 'a', durationMs: 99 * 3_600_000, remainingMs: 0 })).toBeNull();
    expect(parseOrbitMessage({ type: 'sync', orbitId: 'o1', by: 'a', durationMs: 1, remainingMs: 1, status: 'exploded' })).toBeNull();
    expect(parseOrbitMessage({ type: 'launch' })).toBeNull();
  });
});
