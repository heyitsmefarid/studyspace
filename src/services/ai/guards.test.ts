import { describe, expect, it } from 'vitest';
import { corsHeaders, limitError, parseAllowedOrigins, readLimits } from './guards';

describe('limits', () => {
  it('reads env with defaults and a floor of 1', () => {
    const env: Record<string, string> = { AI_MINUTE_LIMIT: 'abc', AI_DAILY_LIMIT: '0' };
    expect(readLimits((k) => env[k])).toEqual({ perMinute: 15, perDay: 1 });
    expect(readLimits(() => undefined)).toEqual({ perMinute: 15, perDay: 200 });
  });
});

describe('cors', () => {
  const allowed = parseAllowedOrigins('https://studyspace.vercel.app, https://ss.netlify.app');
  it('echoes allowed origins and localhost, defaults others to the first allowed origin', () => {
    expect(corsHeaders('https://ss.netlify.app', allowed)['Access-Control-Allow-Origin']).toBe('https://ss.netlify.app');
    expect(corsHeaders('http://localhost:5173', allowed)['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin']).toBe('https://studyspace.vercel.app');
  });
  it('allows any origin when none are configured, and always sets the request headers list', () => {
    const h = corsHeaders('https://x.dev', []);
    expect(h['Access-Control-Allow-Origin']).toBe('*');
    expect(h['Access-Control-Allow-Headers']).toBe('authorization, x-client-info, apikey, content-type');
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
  });
});

describe('limitError (reservation codes)', () => {
  const limits = { perMinute: 15, perDay: 200 };
  it('maps reservation refusals to client errors', () => {
    expect(limitError('DAILY_LIMIT', limits)).toMatchObject({ code: 'DAILY_LIMIT', retryable: false });
    expect(limitError('DAILY_LIMIT', limits)!.message).toMatch(/200 Nova requests/);
    expect(limitError('RATE_LIMITED', limits)).toMatchObject({ code: 'RATE_LIMITED', retryable: true, retryAfter: 60 });
    expect(limitError(null, limits)).toBeNull();
  });
});
