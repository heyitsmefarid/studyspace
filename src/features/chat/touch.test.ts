import { describe, expect, it } from 'vitest';
import { movedBeyond, shouldRestore } from './touch';

describe('movedBeyond', () => {
  it('ignores jitter and cancels past the threshold', () => {
    expect(movedBeyond({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)).toBe(false);
    expect(movedBeyond({ x: 0, y: 0 }, { x: 8, y: 8 }, 10)).toBe(true);
  });
});

describe('shouldRestore', () => {
  it('restores only when older rows were prepended under the same newest message', () => {
    expect(shouldRestore({ lastId: 'a', count: 5 }, { lastId: 'a', count: 10 })).toBe(true);
    expect(shouldRestore({ lastId: 'a', count: 5 }, { lastId: 'a', count: 5 })).toBe(false);
    expect(shouldRestore({ lastId: 'a', count: 5 }, { lastId: 'b', count: 6 })).toBe(false);
  });
});
