import type { AiError } from './types.ts';

export interface Limits { perMinute: number; perDay: number }

const intEnv = (v: string | undefined, dflt: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.max(1, n) : dflt;
};

export function readLimits(get: (k: string) => string | undefined): Limits {
  return { perMinute: intEnv(get('AI_MINUTE_LIMIT'), 15), perDay: intEnv(get('AI_DAILY_LIMIT'), 200) };
}

function wallClock(tz: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

export function zonedMidnightUtc(tz: string, now: Date): Date {
  let w;
  try { w = wallClock(tz, now); } catch { w = wallClock('Asia/Manila', now); }
  const wallAsUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s);
  const offsetMs = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(w.y, w.m - 1, w.d) - offsetMs);
}

export function checkLimits(counts: { lastMinute: number; today: number }, limits: Limits): AiError | null {
  if (counts.today >= limits.perDay) {
    return { code: 'DAILY_LIMIT', message: `You've used all ${limits.perDay} Nova requests for today. They refresh at midnight.`, retryable: false };
  }
  if (counts.lastMinute >= limits.perMinute) {
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
