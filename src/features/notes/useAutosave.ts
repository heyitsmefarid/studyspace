import { useEffect, useMemo, useRef, useState } from 'react';
import { createAutosaver, type SaveStatus } from './autosaver';

export function useAutosave<T>(save: (v: T) => Promise<void>, { delay = 1000 }: { delay?: number } = {}) {
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  const [status, setStatus] = useState<SaveStatus>('idle');
  // createAutosaver only calls save() later from timers, never while constructing, so reading the ref here is safe.
  // eslint-disable-next-line react-hooks/refs
  const saver = useMemo(() => createAutosaver<T>({ save: (v) => saveRef.current(v), delay, onStatus: setStatus }), [delay]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saver.dirty) { void saver.flush(); e.preventDefault(); }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      void saver.flush().finally(() => saver.dispose());
    };
  }, [saver]);

  return { push: saver.push, flush: saver.flush, retry: saver.retry, status };
}
