import { describe, expect, it } from 'vitest';
import { replayAnimation } from './replayAnimation';

// Final review I3: the auth error shake remounted the whole form (key bump), losing focus and field state.
describe('replayAnimation', () => {
  it('restarts a CSS animation on the same element: remove class, force a reflow, add it back', () => {
    const log: string[] = [];
    const el = {
      classList: { remove: (c: string) => log.push(`remove ${c}`), add: (c: string) => log.push(`add ${c}`) },
      get offsetWidth() { log.push('reflow'); return 100; },
    };
    replayAnimation(el, 'animate-shake');
    expect(log).toEqual(['remove animate-shake', 'reflow', 'add animate-shake']);
  });
  it('ignores a missing element', () => {
    expect(() => replayAnimation(null, 'animate-shake')).not.toThrow();
  });
});
