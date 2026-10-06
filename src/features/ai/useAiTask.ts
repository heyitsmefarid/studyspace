import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIResult, AiError, AiMeta } from '@/services/ai/types';

type Status = 'idle' | 'loading' | 'success' | 'empty' | 'error';
interface State<O> { status: Status; data?: O; error?: AiError; meta?: AiMeta }

export function useAiTask<I, O>(
  fn: (input: I, signal: AbortSignal) => Promise<AIResult<O>>,
  opts: { isEmpty?: (o: O) => boolean; onSuccess?: (o: O, meta: AiMeta) => void } = {},
) {
  const [state, setState] = useState<State<O>>({ status: 'idle' });
  const ctrl = useRef<AbortController | null>(null);
  const lastInput = useRef<{ value: I } | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const run = useCallback(async (input: I) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    lastInput.current = { value: input };
    setState({ status: 'loading' });
    const r = await fn(input, c.signal);
    if (c.signal.aborted) return;
    if (!r.ok) { setState({ status: r.error.code === 'EMPTY' ? 'empty' : 'error', error: r.error }); return; }
    if (optsRef.current.isEmpty?.(r.data)) { setState({ status: 'empty', data: r.data, meta: r.meta }); return; }
    setState({ status: 'success', data: r.data, meta: r.meta });
    optsRef.current.onSuccess?.(r.data, r.meta);
  }, [fn]);

  const retry = useCallback(() => { if (lastInput.current) void run(lastInput.current.value); }, [run]);
  const cancel = useCallback(() => { ctrl.current?.abort(); setState({ status: 'idle' }); }, []);
  const reset = useCallback(() => { ctrl.current?.abort(); lastInput.current = null; setState({ status: 'idle' }); }, []);
  useEffect(() => () => ctrl.current?.abort(), []);

  return { ...state, run, retry, cancel, reset };
}
export type AiTaskState<I, O> = ReturnType<typeof useAiTask<I, O>>;
