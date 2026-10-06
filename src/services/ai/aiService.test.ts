import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } }, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' }));
import { createAiClient, parseEnvelope } from './aiService';

const client = (fetchImpl: typeof fetch, token: string | null = 'jwt') =>
  createAiClient({ fetchImpl, baseUrl: 'https://x.supabase.co', anonKey: 'anon', getToken: async () => token });

describe('aiService', () => {
  it('posts the task with the user token and returns the envelope', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true, data: { text: 'hi' }, meta: { provider: 'gemini', model: 'g', fellBack: false } })));
    const r = await client(fetchImpl).generateSummary({ text: 'notes' });
    expect(r).toMatchObject({ ok: true, data: { text: 'hi' } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://x.supabase.co/functions/v1/ai');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
    expect(JSON.parse(String(init!.body))).toEqual({ task: 'summarize', input: { text: 'notes' } });
  });
  it('never throws: no session, network failure, non-JSON and gateway errors map to codes', async () => {
    expect(await client(vi.fn<typeof fetch>(), null).askTutor({ mode: 'deep', difficulty: 'beginner', messages: [{ role: 'user', content: 'x' }] }))
      .toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    expect(await client(vi.fn<typeof fetch>(async () => { throw new TypeError('Failed to fetch'); })).generateSummary({ text: 'x' }))
      .toMatchObject({ ok: false, error: { code: 'NETWORK', retryable: true } });
    expect(await client(vi.fn<typeof fetch>(async () => new Response('<html>oops</html>', { status: 502 }))).generateSummary({ text: 'x' }))
      .toMatchObject({ ok: false, error: { code: 'NETWORK' } });
  });
  it('parses envelopes and falls back on HTTP status', () => {
    expect(parseEnvelope({ ok: false, error: { code: 'DAILY_LIMIT', message: 'm', retryable: false } }, 429)).toEqual({ ok: false, error: { code: 'DAILY_LIMIT', message: 'm', retryable: false } });
    expect(parseEnvelope({ code: 401, message: 'Invalid JWT' }, 401)).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    expect(parseEnvelope({ ok: false, error: { code: 'WHAT', message: 'x' } }, 200)).toMatchObject({ ok: false, error: { code: 'NETWORK' } });
    expect(parseEnvelope({}, 404)).toMatchObject({ ok: false, error: { code: 'PROVIDER_UNAVAILABLE' } });
  });
});
