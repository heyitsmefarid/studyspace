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
