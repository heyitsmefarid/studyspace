import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExitGate } from './exitGate';

// Review Focus #3: pressing 3 then 4 during the exit animation grades the card once.
describe('createExitGate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the action after the delay and ignores presses meanwhile', () => {
    const gate = createExitGate(220);
    const grade = vi.fn();
    expect(gate.run(() => grade(2))).toBe(true);
    expect(gate.run(() => grade(3))).toBe(false);
    expect(gate.busy).toBe(true);
    vi.advanceTimersByTime(219);
    expect(grade).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(grade).toHaveBeenCalledExactlyOnceWith(2);
    expect(gate.busy).toBe(false);
    expect(gate.run(() => grade(1))).toBe(true);
  });

  it('runs immediately with no delay (reduced motion)', () => {
    const gate = createExitGate(0);
    const grade = vi.fn();
    gate.run(() => grade(0));
    expect(grade).toHaveBeenCalledOnce();
    expect(gate.busy).toBe(false);
  });
});

// Final review C1: with reduced motion the gate runs synchronously, so the caller must not set "leaving" after it.
describe('runExit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ends on leaving = null when the exit is instant (reduced motion)', async () => {
    const { runExit } = await import('./exitGate');
    const leaving: (number | null)[] = [];
    const commit = vi.fn();
    expect(runExit(createExitGate(0), 2, (v) => leaving.push(v), commit)).toBe(true);
    expect(leaving.at(-1)).toBeNull();
    expect(commit).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('shows the exit, then commits once and clears it; presses during the exit are ignored', async () => {
    const { runExit } = await import('./exitGate');
    const gate = createExitGate(220);
    const leaving: (number | null)[] = [];
    const commit = vi.fn();
    runExit(gate, 2, (v) => leaving.push(v), commit);
    expect(runExit(gate, 3, (v) => leaving.push(v), commit)).toBe(false);
    expect(leaving).toEqual([2]);
    vi.advanceTimersByTime(220);
    expect(leaving).toEqual([2, null]);
    expect(commit).toHaveBeenCalledExactlyOnceWith(2);
  });
});

// Deferred U6: a grade pressed during the exit animation must not be lost when the session ends or unmounts.
describe('createExitGate flush', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs a pending action now, exactly once', () => {
    const gate = createExitGate(220);
    const grade = vi.fn();
    gate.run(() => grade(2));
    gate.flush();
    expect(grade).toHaveBeenCalledExactlyOnceWith(2);
    expect(gate.busy).toBe(false);
    vi.advanceTimersByTime(500);
    expect(grade).toHaveBeenCalledOnce();
  });

  it('does nothing when no exit is pending', () => {
    const gate = createExitGate(220);
    expect(() => gate.flush()).not.toThrow();
    expect(gate.busy).toBe(false);
  });
});
