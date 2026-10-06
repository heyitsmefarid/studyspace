/** Lets a graded card play its exit before the next card, ignoring extra presses until it has gone. */
export function createExitGate(delayMs: number) {
  let busy = false;
  let pending: { timer: ReturnType<typeof setTimeout>; fn: () => void } | null = null;
  const fire = () => {
    const p = pending;
    pending = null;
    busy = false;
    p?.fn();
  };
  return {
    run(fn: () => void): boolean {
      if (busy) return false;
      if (delayMs <= 0) { fn(); return true; }
      busy = true;
      pending = { timer: setTimeout(fire, delayMs), fn };
      return true;
    },
    /** Runs a pending action now (session finished or unmounting) so a pressed grade is never dropped. */
    flush(): void {
      if (pending) clearTimeout(pending.timer);
      fire();
    },
    get busy() { return busy; },
  };
}

/**
 * Shows a card's exit (`setLeaving(value)`), then clears it and commits the grade once the gate lets it through.
 * Order matters: with an instant gate (reduced motion) the callback runs synchronously, so `leaving` must be set
 * before it — never after — or the next card mounts already "leaving" and stays invisible.
 */
export function runExit<T>(gate: ReturnType<typeof createExitGate>, value: T, setLeaving: (v: T | null) => void, commit: (v: T) => void): boolean {
  if (gate.busy) return false;
  setLeaving(value);
  return gate.run(() => { setLeaving(null); commit(value); });
}
