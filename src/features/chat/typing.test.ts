import { describe, expect, it } from 'vitest';
import { TYPING_SEND_EVERY_MS, shouldSendTyping } from './typing';

describe('shouldSendTyping', () => {
  it('sends the first keystroke, then at most every 2 s', () => {
    expect(shouldSendTyping(null, 0)).toBe(true);
    expect(shouldSendTyping(0, TYPING_SEND_EVERY_MS - 1)).toBe(false);
    expect(shouldSendTyping(0, TYPING_SEND_EVERY_MS)).toBe(true);
  });
});
