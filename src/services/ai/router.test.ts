import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTask } from './router';
import { ProviderError, type AIProvider, type ProviderName, type ProviderRequest } from './types';

type Step = string | ProviderError | 'hang';
function fake(name: ProviderName, script: Step[], available = true) {
  const calls: ProviderRequest[] = [];
  const p: AIProvider & { calls: ProviderRequest[] } = {
    name, model: `${name}-test`, available, calls,
    async generate(req) {
      calls.push(req);
      const next = script.shift();
      if (next === undefined) throw new Error('no scripted reply');
      if (next === 'hang') return new Promise<string>((_, reject) => req.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
      if (next instanceof ProviderError) throw next;
      return next;
    },
  };
  return p;
}
const sleep = vi.fn(async (_ms: number) => {});
beforeEach(() => sleep.mockClear());
const CARDS = JSON.stringify({ cards: [
  { question: 'Why do cells need ATP?', answer: 'It powers reactions.', difficulty: 'medium', topic: 'Energy' },
  { question: 'Which organelle makes most ATP?', answer: 'The mitochondrion.', difficulty: 'easy', topic: 'Organelles' },
] });
const note = { text: 'Mitochondria make ATP which powers the cell.', count: 5 };

describe('runTask', () => {
  it('returns Gemini results without fallback', async () => {
    const gemini = fake('gemini', ['A clear summary.']); const groq = fake('groq', []);
    const r = await runTask('summarize', { text: 'notes' }, { providers: { gemini, groq }, sleep });
    expect(r).toEqual({ ok: true, data: { text: 'A clear summary.' }, meta: { provider: 'gemini', model: 'gemini-test', fellBack: false } });
  });
  it('retries Gemini once on a rate limit (capped wait), then falls back to Groq', async () => {
    const gemini = fake('gemini', [new ProviderError('rate_limit', '429', 12000), new ProviderError('rate_limit', '429')]);
    const groq = fake('groq', ['Groq summary.']);
    const r = await runTask('summarize', { text: 'notes' }, { providers: { gemini, groq }, sleep });
    expect(gemini.calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(3000);
    expect(r.ok && r.meta).toMatchObject({ provider: 'groq', fellBack: true });
  });
  it('does not retry auth errors but still falls back', async () => {
    const gemini = fake('gemini', [new ProviderError('auth', 'bad key')]); const groq = fake('groq', ['ok']);
    const r = await runTask('explain', { text: 'notes' }, { providers: { gemini, groq }, sleep });
    expect(gemini.calls).toHaveLength(1);
    expect(r.ok).toBe(true);
  });
  it('repairs invalid JSON once with the same provider', async () => {
    const gemini = fake('gemini', ['Sure! Here you go', CARDS]); const groq = fake('groq', []);
    const r = await runTask('flashcards', note, { providers: { gemini, groq }, sleep });
    expect(gemini.calls).toHaveLength(2);
    expect(gemini.calls[1]!.messages.at(-1)!.content).toMatch(/not valid JSON/i);
    expect(r.ok && (r.data as { cards: unknown[] }).cards).toHaveLength(2);
  });
  it('returns INVALID_OUTPUT when the repair is invalid too', async () => {
    const gemini = fake('gemini', ['nope', 'still nope']); const groq = fake('groq', []);
    const r = await runTask('flashcards', note, { providers: { gemini, groq }, sleep });
    expect(!r.ok && r.error).toMatchObject({ code: 'INVALID_OUTPUT', retryable: true });
  });
  it('sends the JSON schema only for structured tasks', async () => {
    const gemini = fake('gemini', [CARDS, 'text']); const groq = fake('groq', []);
    await runTask('flashcards', note, { providers: { gemini, groq }, sleep });
    await runTask('summarize', { text: 'n' }, { providers: { gemini, groq }, sleep });
    expect(gemini.calls[0]!.jsonSchema).toBeDefined();
    expect(gemini.calls[1]!.jsonSchema).toBeUndefined();
  });
  it('reports a retryable PROVIDER_UNAVAILABLE when both providers fail', async () => {
    const gemini = fake('gemini', [new ProviderError('unavailable', '503'), new ProviderError('unavailable', '503')]);
    const groq = fake('groq', [new ProviderError('unavailable', '503')]);
    const r = await runTask('summarize', { text: 'n' }, { providers: { gemini, groq }, sleep });
    expect(!r.ok && r.error).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: true });
  });
  it('reports a non-retryable PROVIDER_UNAVAILABLE when nothing is configured', async () => {
    const r = await runTask('summarize', { text: 'n' }, { providers: { gemini: fake('gemini', [], false), groq: fake('groq', [], false) }, sleep });
    expect(!r.ok && r.error).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: false });
  });
  it('rejects bad input before calling any provider', async () => {
    const gemini = fake('gemini', []); const groq = fake('groq', []);
    const r = await runTask('flashcards', { text: '' }, { providers: { gemini, groq }, sleep });
    expect(!r.ok && r.error.code).toBe('BAD_INPUT');
    expect(gemini.calls).toHaveLength(0);
  });
  it('sends fast tutor requests to Groq first', async () => {
    const gemini = fake('gemini', []); const groq = fake('groq', ['Quick answer']);
    const r = await runTask('tutor', { mode: 'explain_simply', difficulty: 'beginner', fast: true, messages: [{ role: 'user', content: 'What is ATP?' }] }, { providers: { gemini, groq }, sleep });
    expect(r.ok && r.meta).toMatchObject({ provider: 'groq', fellBack: false });
  });
  it('times out a hanging provider and falls back', async () => {
    const gemini = fake('gemini', ['hang', 'hang']); const groq = fake('groq', ['late but fine']);
    const r = await runTask('summarize', { text: 'n' }, { providers: { gemini, groq }, sleep, timeoutMs: 20 });
    expect(r.ok && r.meta.provider).toBe('groq');
  });
  it('returns EMPTY when every provider returns nothing', async () => {
    const gemini = fake('gemini', [new ProviderError('empty', 'blocked')]); const groq = fake('groq', ['   ']);
    const r = await runTask('summarize', { text: 'n' }, { providers: { gemini, groq }, sleep });
    expect(!r.ok && r.error.code).toBe('EMPTY');
  });
  it('returns EMPTY (not invalid) when cleanup removes every item', async () => {
    const dupes = JSON.stringify({ cards: [{ question: 'What is ATP?', answer: 'x' }] });
    const gemini = fake('gemini', [dupes]); const groq = fake('groq', []);
    const r = await runTask('flashcards', { ...note, existing: ['What is ATP?'] }, { providers: { gemini, groq }, sleep });
    expect(!r.ok && r.error.code).toBe('EMPTY');
  });
});
