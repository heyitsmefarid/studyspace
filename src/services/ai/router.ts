import { fail, ProviderError, type AIProvider, type AIResult, type AiTask, type ProviderErrorKind, type ProviderName, type ProviderRequest } from './types.ts';
import { primaryFor, TASK_DEFS, type TaskDef } from './tasks.ts';
import { parseJsonLoose, type Finalized } from './postprocess.ts';
import { repairMessage } from './prompts.ts';

export interface RunDeps {
  providers: Record<ProviderName, AIProvider>;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

const EMPTY_MESSAGES: Partial<Record<AiTask, string>> = {
  flashcards: "Nova couldn't find new flashcards in that material — try a longer note or a different section.",
  quiz: "Nova couldn't build quiz questions from that material — try a longer note.",
  recommendations: 'Nothing to recommend yet — study a little and check back.',
};

async function callWithTimeout(p: AIProvider, req: ProviderRequest, ms: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p.generate({ ...req, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new ProviderError('timeout', `${p.name} timed out`);
    throw e instanceof ProviderError ? e : new ProviderError('unavailable', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

function finalizeStructured(def: TaskDef, text: string, input: unknown): Finalized<unknown> {
  const json = parseJsonLoose(text);
  if (json === undefined) return { ok: false, reason: 'invalid', detail: 'The reply was not JSON' };
  return def.finalize(json, input);
}

export async function runTask(task: AiTask, rawInput: unknown, deps: RunDeps): Promise<AIResult<unknown>> {
  const def = TASK_DEFS[task];
  const parsed = def.input.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail('BAD_INPUT', first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid request.');
  }
  const input = parsed.data;
  const prompt = def.build(input);
  const primary = primaryFor(task, input);
  const order = [primary, primary === 'gemini' ? 'groq' : 'gemini']
    .map((n) => deps.providers[n as ProviderName])
    .filter((p): p is AIProvider => Boolean(p?.available));
  if (order.length === 0) {
    return fail('PROVIDER_UNAVAILABLE', "Nova isn't connected to an AI provider yet — add the API keys in Supabase.", false);
  }

  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const kinds: ProviderErrorKind[] = [];
  let retryAfterMs: number | undefined;

  for (let i = 0; i < order.length; i++) {
    const provider = order[i]!;
    const req: ProviderRequest = {
      ...prompt,
      ...(def.structured && def.jsonSchema ? { jsonSchema: def.jsonSchema } : {}),
      temperature: def.temperature,
      maxOutputTokens: def.maxOutputTokens,
    };

    let text: string | null = null;
    for (let attempt = 0; attempt < 2 && text === null; attempt++) {
      try {
        text = await callWithTimeout(provider, req, timeoutMs);
      } catch (e) {
        const pe = e as ProviderError;
        kinds.push(pe.kind);
        retryAfterMs = pe.retryAfterMs ?? retryAfterMs;
        const transient = pe.kind === 'rate_limit' || pe.kind === 'unavailable' || pe.kind === 'timeout';
        if (transient && attempt === 0 && i === 0) { await sleep(Math.min(pe.retryAfterMs ?? 1000, 3000)); continue; }
        break;
      }
    }
    if (text === null) continue;

    const meta = { provider: provider.name, model: provider.model, fellBack: i > 0 };
    if (!def.structured) {
      const r = def.finalize(text, input);
      if (r.ok) return { ok: true, data: r.data, meta };
      kinds.push('empty');
      continue;
    }

    let result = finalizeStructured(def, text, input);
    if (!result.ok && result.reason === 'invalid') {
      try {
        const repaired = await callWithTimeout(provider, {
          ...req,
          messages: [...prompt.messages, { role: 'assistant', content: text.slice(0, 6000) }, { role: 'user', content: repairMessage(result.detail) }],
        }, timeoutMs);
        result = finalizeStructured(def, repaired, input);
      } catch { /* keep the invalid result */ }
    }
    if (result.ok) return { ok: true, data: result.data, meta };
    if (result.reason === 'empty') return fail('EMPTY', EMPTY_MESSAGES[task] ?? 'Nova came back empty-handed — try again or add more detail.', true);
    return fail('INVALID_OUTPUT', "Nova's answer came back garbled. Try again.", true);
  }

  if (kinds.length > 0 && kinds.every((k) => k === 'empty')) {
    return fail('EMPTY', EMPTY_MESSAGES[task] ?? 'Nova came back empty-handed — try rephrasing.', true);
  }
  if (kinds.includes('rate_limit')) {
    return fail('PROVIDER_UNAVAILABLE', "Nova's AI providers are busy right now. Try again in a minute.", true, Math.ceil((retryAfterMs ?? 30_000) / 1000));
  }
  return fail('PROVIDER_UNAVAILABLE', "Nova can't reach its AI providers right now. Try again shortly.", true, 30);
}
