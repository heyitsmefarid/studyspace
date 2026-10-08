import { describe, expect, it } from 'vitest';
import { weekStartIso } from './week';

describe('weekStartIso', () => {
  it('is Monday 00:00 in Manila', () => {
    expect(weekStartIso('Asia/Manila', new Date('2026-10-08T04:00:00Z'))).toBe('2026-10-04T16:00:00.000Z');
  });
  it('keeps a Sunday night in the week that began on Monday', () => {
    expect(weekStartIso('Asia/Manila', new Date('2026-10-11T15:00:00Z'))).toBe('2026-10-04T16:00:00.000Z'); // Sun 23:00 Manila
  });
  it('follows daylight saving time', () => {
    expect(weekStartIso('America/New_York', new Date('2026-11-04T17:00:00Z'))).toBe('2026-11-02T05:00:00.000Z');
    expect(weekStartIso('America/New_York', new Date('2026-03-11T17:00:00Z'))).toBe('2026-03-09T04:00:00.000Z');
  });
});
