import { useEffect, useRef } from 'react';

export function useHotkey(combo: 'mod+k' | 'mod+s', handler: () => void) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    const key = combo.split('+')[1]!;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === key) { e.preventDefault(); ref.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo]);
}
