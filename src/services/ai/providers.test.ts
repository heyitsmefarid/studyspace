import { describe, expect, it, vi } from 'vitest';
import { createGeminiProvider } from './geminiProvider';
import { createGroqProvider } from './groqProvider';
import type { ProviderRequest } from './types';

const req: ProviderRequest = { system: 'SYS', messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }, { role: 'user', content: 'again' }], temperature: 0.2, maxOutputTokens: 100 };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('gemini provider', () => {
  it('is unavailable without a key or model', () => {
    expect(createGeminiProvider({ apiKey: 'k' }).available).toBe(false);
    expect(createGeminiProvider({ model: 'm' }).available).toBe(false);
    expect(createGeminiProvider({ apiKey: 'k', model: 'm' }).available).toBe(true);
  });
  it('sends system + mapped roles + schema and joins non-thought text parts', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: '{"a":' }, { text: '1}' }] } }] }));
    const text = await createGeminiProvider({ apiKey: 'KEY', model: 'gemini-x', fetchImpl }).generate({ ...req, jsonSchema: { type: 'object' } });
    expect(text).toBe('{"a":1}');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY');
    const body = JSON.parse(String(init!.body));
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(body.generationConfig).toEqual({ temperature: 0.2, maxOutputTokens: 100, responseMimeType: 'application/json', responseJsonSchema: { type: 'object' } });
  });
  it('maps 429 RetryInfo to rate_limit with retryAfterMs', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12s' }] } }, 429));
    await expect(createGeminiProvider({ apiKey: 'k', model: 'm', fetchImpl }).generate(req)).rejects.toMatchObject({ kind: 'rate_limit', retryAfterMs: 12000 });
  });
  it('maps 503 to unavailable, 403 to auth and a blocked prompt to empty', async () => {
    const p = (r: Response) => createGeminiProvider({ apiKey: 'k', model: 'm', fetchImpl: vi.fn<typeof fetch>(async () => r) }).generate(req);
    await expect(p(json({}, 503))).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(p(json({}, 403))).rejects.toMatchObject({ kind: 'auth' });
    await expect(p(json({ promptFeedback: { blockReason: 'SAFETY' } }))).rejects.toMatchObject({ kind: 'empty' });
  });
  it('retries once without responseJsonSchema when Gemini rejects that field', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: { message: 'Invalid JSON payload received. Unknown name "responseJsonSchema"' } }, 400))
      .mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }));
    await createGeminiProvider({ apiKey: 'k', model: 'm', fetchImpl }).generate({ ...req, jsonSchema: { type: 'object' } });
    const second = JSON.parse(String(fetchImpl.mock.calls[1]![1]!.body));
    expect(second.generationConfig.responseJsonSchema).toBeUndefined();
    expect(second.generationConfig.responseMimeType).toBe('application/json');
  });
  it('maps a thrown fetch to unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new TypeError('fetch failed'); });
    await expect(createGeminiProvider({ apiKey: 'k', model: 'm', fetchImpl }).generate(req)).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('groq provider', () => {
  it('sends an OpenAI-style body with the system message first and JSON mode when structured', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: ' {"x":1} ' } }] }));
    const text = await createGroqProvider({ apiKey: 'G', model: 'llama', fetchImpl }).generate({ ...req, jsonSchema: { type: 'object' } });
    expect(text).toBe('{"x":1}');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer G');
    const body = JSON.parse(String(init!.body));
    expect(body).toMatchObject({ model: 'llama', temperature: 0.2, max_completion_tokens: 100, response_format: { type: 'json_object' } });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(body.messages).toHaveLength(4);
  });
  it('maps 429 retry-after seconds and 401', async () => {
    const p = (r: Response) => createGroqProvider({ apiKey: 'k', model: 'm', fetchImpl: vi.fn<typeof fetch>(async () => r) }).generate(req);
    await expect(p(json({}, 429, { 'retry-after': '7' }))).rejects.toMatchObject({ kind: 'rate_limit', retryAfterMs: 7000 });
    await expect(p(json({}, 401))).rejects.toMatchObject({ kind: 'auth' });
  });
  it('returns failed_generation text when JSON validation fails so the router can repair it', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ error: { code: 'json_validate_failed', failed_generation: '{"cards": [' } }, 400));
    await expect(createGroqProvider({ apiKey: 'k', model: 'm', fetchImpl }).generate({ ...req, jsonSchema: {} })).resolves.toBe('{"cards": [');
  });
});
