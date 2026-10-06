import type { AiError } from './types.ts';

export interface Limits { perMinute: number; perDay: number }

const intEnv = (v: string | undefined, dflt: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.max(1, n) : dflt;
};

export function readLimits(get: (k: string) => string | undefined): Limits {
  return { perMinute: intEnv(get('AI_MINUTE_LIMIT'), 15), perDay: intEnv(get('AI_DAILY_LIMIT'), 200) };
}

/** Client error for a refused reservation (codes come from public.reserve_ai_request). */
export function limitError(code: string | null, limits: Limits): AiError | null {
  if (code === 'DAILY_LIMIT') {
    return { code: 'DAILY_LIMIT', message: `You've used all ${limits.perDay} Nova requests in the last 24 hours. Older ones free up as the day rolls on.`, retryable: false };
  }
  if (code === 'RATE_LIMITED') {
    return { code: 'RATE_LIMITED', message: 'Nova needs a breather — try again in a minute.', retryable: true, retryAfter: 60 };
  }
  return null;
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  let allow = '*';
  if (allowed.length) allow = origin && (allowed.includes(origin) || LOCAL.test(origin)) ? origin : allowed[0]!;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
