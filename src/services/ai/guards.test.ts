import { describe, expect, it } from 'vitest';
import { checkLimits, corsHeaders, parseAllowedOrigins, readLimits, zonedMidnightUtc } from './guards';

describe('zonedMidnightUtc', () => {
  it('finds local midnight in Manila (00:30 PHT = 16:30Z previous day)', () => {
    expect(zonedMidnightUtc('Asia/Manila', new Date('2026-10-05T16:30:00Z')).toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(zonedMidnightUtc('Asia/Manila', new Date('2026-10-05T15:59:00Z')).toISOString()).toBe('2026-10-04T16:00:00.000Z');
  });
  it('works for UTC and falls back to Manila for unknown zones', () => {
    expect(zonedMidnightUtc('UTC', new Date('2026-10-05T16:30:00Z')).toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(zonedMidnightUtc('Nope/Zone', new Date('2026-10-05T16:30:00Z')).toISOString()).toBe('2026-10-05T16:00:00.000Z');
  });
});

describe('limits', () => {
  const limits = { perMinute: 15, perDay: 200 };
  it('daily limit wins and is not retryable', () => {
    expect(checkLimits({ lastMinute: 20, today: 200 }, limits)).toMatchObject({ code: 'DAILY_LIMIT', retryable: false });
  });
  it('minute limit is retryable after 60 s', () => {
    expect(checkLimits({ lastMinute: 15, today: 10 }, limits)).toMatchObject({ code: 'RATE_LIMITED', retryable: true, retryAfter: 60 });
  });
  it('passes under both limits', () => {
    expect(checkLimits({ lastMinute: 14, today: 199 }, limits)).toBeNull();
  });
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
