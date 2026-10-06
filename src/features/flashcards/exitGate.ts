/** Lets a graded card play its exit before the next card, ignoring extra presses until it has gone. */
export function createExitGate(delayMs: number) {
  let busy = false;
  return {
    run(fn: () => void): boolean {
      if (busy) return false;
      if (delayMs <= 0) { fn(); return true; }
      busy = true;
      setTimeout(() => { busy = false; fn(); }, delayMs);
      return true;
    },
    get busy() { return busy; },
  };
}
