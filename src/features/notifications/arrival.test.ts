import { describe, expect, it } from 'vitest';
import { arrivalAction, systemAllowed } from './arrival';

const msg = { kind: 'message', dedupe_key: 'chat:r:1' };
const star = { kind: 'message', dedupe_key: 'star:m1' };
const exam = { kind: 'exam', dedupe_key: 'exam:t:1' };
const ctx = (over: Partial<{ pathname: string; hidden: boolean; systemAllowed: boolean }> = {}) =>
  ({ pathname: '/', hidden: false, systemAllowed: false, ...over });

describe('systemAllowed', () => {
  it('needs the switch on and permission granted', () => {
    expect(systemAllowed(true, 'granted')).toBe(true);
    expect(systemAllowed(false, 'granted')).toBe(false);
    expect(systemAllowed(true, 'denied')).toBe(false);
    expect(systemAllowed(true, 'default')).toBe(false);
    expect(systemAllowed(true, 'unsupported')).toBe(false);
  });
});

describe('arrivalAction', () => {
  it('uses a system notification only for a hidden tab with system notifications allowed', () => {
    expect(arrivalAction(exam, ctx({ hidden: true, systemAllowed: true }))).toBe('system');
    expect(arrivalAction(exam, ctx({ hidden: true }))).toBe('toast');
    expect(arrivalAction(exam, ctx({ systemAllowed: true }))).toBe('toast');
  });
  it('marks message notifications read while the chat is open', () => {
    expect(arrivalAction(msg, ctx({ pathname: '/chat' }))).toBe('mark-read');
    expect(arrivalAction(msg, ctx())).toBe('toast');
  });
  it('leaves shooting stars to their overlay', () => {
    expect(arrivalAction(star, ctx())).toBe('silent');
  });
});
