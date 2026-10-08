import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KINDS, kindEnabled } from './kinds';

describe('notification kinds', () => {
  it('lists exactly the kinds the database allows', () => {
    expect(NOTIFICATION_KINDS.map((k) => k.kind).sort()).toEqual(
      ['achievement', 'deadline', 'exam', 'message', 'shared_deck', 'shared_note', 'streak', 'study_reminder']);
  });
  it('treats a kind as on unless it is explicitly switched off (like private.notify)', () => {
    expect(kindEnabled({}, 'exam')).toBe(true);
    expect(kindEnabled({ exam: true }, 'exam')).toBe(true);
    expect(kindEnabled({ exam: false }, 'exam')).toBe(false);
  });
});
