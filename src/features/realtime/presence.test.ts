import { describe, expect, it } from 'vitest';
import { backoffMs, partnerPresence, presenceLabel, type PresenceMeta } from './presence';

const P = 'partner-id';
const meta = (m: Partial<PresenceMeta>): PresenceMeta => ({ userId: P, status: 'online', ...m });

describe('partnerPresence', () => {
  it('is offline without a partner or without their presence', () => {
    expect(partnerPresence({ x: [meta({})] }, null)).toEqual({ state: 'offline' });
    expect(partnerPresence({ me: [meta({ userId: 'me' })] }, P)).toEqual({ state: 'offline' });
  });
  it('is online when any of their tabs is present', () => {
    expect(partnerPresence({ [P]: [meta({})] }, P)).toEqual({ state: 'online' });
  });
  it('prefers studying over online across tabs', () => {
    const state = { [P]: [meta({}), meta({ status: 'studying', subject: 'Biology', endsAt: 1000 })] };
    expect(partnerPresence(state, P)).toEqual({ state: 'studying', subject: 'Biology', endsAt: 1000 });
  });
});

describe('presenceLabel', () => {
  it('describes each state', () => {
    expect(presenceLabel({ state: 'offline' }, 0)).toBeNull();
    expect(presenceLabel({ state: 'online' }, 0)).toBe('Online');
    expect(presenceLabel({ state: 'studying', subject: null, endsAt: null }, 0)).toBe('Studying');
    expect(presenceLabel({ state: 'studying', subject: 'Biology', endsAt: 12 * 60_000 }, 0)).toBe('Studying Biology · 12 min left');
  });
  it('never shows a negative time left', () => {
    expect(presenceLabel({ state: 'studying', subject: 'Art', endsAt: 0 }, 60_000)).toBe('Studying Art · 0 min left');
  });
});

describe('backoffMs', () => {
  it('doubles from 1 s and caps at 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});
