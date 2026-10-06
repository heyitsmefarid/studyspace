export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function createAutosaver<T>(opts: {
  save: (v: T) => Promise<void>;
  delay?: number;
  retryDelays?: number[];
  onStatus?: (s: SaveStatus) => void;
}) {
  const delay = opts.delay ?? 1000;
  const retryDelays = opts.retryDelays ?? [2000, 5000, 15000];
  let latest: T | undefined;
  let dirty = false;
  let status: SaveStatus = 'idle';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let failures = 0;
  let disposed = false;

  const setStatus = (s: SaveStatus) => { status = s; opts.onStatus?.(s); };
  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void run(); }, ms);
  };

  /** `force` (flush) saves even when disposed; timers and retries only run while active. */
  function run(force = false): Promise<void> {
    if ((disposed && !force) || !dirty) return Promise.resolve();
    if (inFlight) return inFlight; // the in-flight save re-checks `dirty` when it settles
    const snapshot = latest as T;
    dirty = false;
    setStatus('saving');
    inFlight = (async () => {
      try {
        await opts.save(snapshot);
        failures = 0;
        inFlight = undefined;
        if (dirty) { setStatus('pending'); schedule(0); } else setStatus('saved');
      } catch {
        inFlight = undefined;
        dirty = true;
        setStatus('error');
        const wait = retryDelays[failures];
        failures++;
        if (wait !== undefined) schedule(wait);
      }
    })();
    return inFlight;
  }

  return {
    push(v: T) {
      latest = v;
      dirty = true;
      if (status === 'error') return; // the pending retry timer will carry the newest value
      setStatus('pending');
      if (!inFlight) schedule(delay);
    },
    async flush() {
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (inFlight) await inFlight;
      if (dirty) await run(true);
    },
    retry() { failures = 0; schedule(0); },
    /** Stops scheduled saves and retries; flush() still saves. Reversible with revive() (StrictMode/Fast Refresh remount). */
    dispose() { disposed = true; if (timer) { clearTimeout(timer); timer = undefined; } },
    revive() {
      disposed = false;
      if (dirty && !inFlight && !timer) schedule(status === 'error' ? 0 : delay);
    },
    get status() { return status; },
    get dirty() { return dirty || Boolean(inFlight); },
  };
}
