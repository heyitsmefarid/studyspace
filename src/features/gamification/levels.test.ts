import { describe, expect, it } from 'vitest';
import { levelFromXp, levelProgress, rankForLevel, xpForLevel } from './levels';

describe('levels', () => {
  it('uses cumulative XP 50·n·(n−1)', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });
  it('computes level from xp at boundaries', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(999)).toBe(4);
    expect(levelFromXp(1000)).toBe(5);
    expect(levelFromXp(-50)).toBe(1);
  });
  it('maps levels to star ranks', () => {
    expect([1, 2, 3, 5, 8, 12, 17, 25, 40].map(rankForLevel)).toEqual(
      ['Stardust', 'Stardust', 'Comet', 'Moon', 'Planet', 'Star', 'Nebula', 'Galaxy', 'Galaxy']);
  });
  it('reports progress inside the level', () => {
    expect(levelProgress(150)).toEqual({ level: 2, rank: 'Stardust', into: 50, needed: 200, pct: 0.25 });
  });
});
