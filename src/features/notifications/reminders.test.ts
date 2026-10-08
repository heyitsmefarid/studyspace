import { describe, expect, it } from 'vitest';
import { reminderDue } from './reminders';

describe('reminderDue', () => {
  it('runs the first time, then at most hourly', () => {
    expect(reminderDue(null, 0)).toBe(true);
    expect(reminderDue(0, 59 * 60_000)).toBe(false);
    expect(reminderDue(0, 60 * 60_000)).toBe(true);
  });
});
