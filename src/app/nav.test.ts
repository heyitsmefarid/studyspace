import { describe, expect, it } from 'vitest';
import { MOBILE_TABS, MORE_ITEMS, NAV } from './nav';

describe('nav', () => {
  it('has exactly the five mobile tabs from the spec', () => {
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(['Home', 'Notes', 'Study', 'Nova', 'Our Space']);
  });
  it('uses plain labels and unique paths, and More holds the rest', () => {
    const paths = NAV.map((n) => n.to);
    expect(new Set(paths).size).toBe(paths.length);
    expect(NAV.map((n) => n.label)).toEqual(expect.arrayContaining(['Notes', 'Flashcards', 'Quizzes', 'Planner', 'Study', 'Nova', 'Stats', 'Settings']));
    expect(MORE_ITEMS.length + MOBILE_TABS.length).toBe(NAV.length);
  });
  it('has no Market and no "soon" items', () => {
    expect(NAV.map((n) => n.to)).not.toContain('/market');
    expect(NAV.some((n) => 'phase' in n)).toBe(false);
  });
});
