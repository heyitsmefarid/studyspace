import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, readPreferences } from './preferences';

describe('readPreferences', () => {
  it('fills every default from nothing', () => {
    expect(readPreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES.study.focusMin).toBe(25);
    expect(DEFAULT_PREFERENCES.ai.fastMode).toBe(false);
    expect(DEFAULT_PREFERENCES.theme).toBe('system');
  });
  it('keeps valid values and replaces invalid ones individually', () => {
    const p = readPreferences({ theme: 'night', study: { focusMin: 50, shortMin: -3 }, ai: { difficulty: 'wizard' } });
    expect(p.theme).toBe('night');
    expect(p.study.focusMin).toBe(50);
    expect(p.study.shortMin).toBe(5);
    expect(p.ai.difficulty).toBe('intermediate');
  });
});
