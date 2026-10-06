import { describe, expect, it } from 'vitest';
import { layoutSky, type SkySession } from './sky';

const now = new Date('2026-10-06T12:00:00Z');
const s = (id: string, subject: string | null, mins: number, daysAgo: number): SkySession =>
  ({ id, subject_id: subject, focus_seconds: mins * 60, started_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString() });
const subjects = [{ id: 'bio', name: 'Biology', color: '#5FE0C8', mastery: 1 }, { id: 'chem', name: 'Chemistry', color: '#FF8A7A', mastery: 0 }];
const opts = { width: 800, height: 320, now, meColor: '#7CC4FF' };

describe('layoutSky', () => {
  it('is empty for no sessions', () => {
    expect(layoutSky([], subjects, opts)).toEqual({ stars: [], lines: [] });
  });
  it('is deterministic, in bounds, sized by duration and twinkles when recent', () => {
    const sessions = [s('a', 'bio', 25, 0), s('b', 'bio', 90, 10), s('c', null, 5, 1)];
    const a = layoutSky(sessions, subjects, opts);
    expect(a).toEqual(layoutSky(sessions, subjects, opts));
    for (const st of a.stars) {
      expect(st.x).toBeGreaterThanOrEqual(12); expect(st.x).toBeLessThanOrEqual(788);
      expect(st.y).toBeGreaterThanOrEqual(12); expect(st.y).toBeLessThanOrEqual(308);
    }
    const byId = Object.fromEntries(a.stars.map((x) => [x.id, x]));
    expect(byId.b!.r).toBeGreaterThan(byId.a!.r);
    expect([byId.a!.twinkle, byId.b!.twinkle, byId.c!.twinkle]).toEqual([true, false, true]);
    expect(byId.a!.color).toBe('#5FE0C8');
    expect(byId.c!.color).toBe('#7CC4FF');
    expect(byId.a!.label).toMatch(/^Biology · 25 min · /);
  });
  it('links stars chronologically within a subject only, brighter with mastery', () => {
    const sessions = [s('b1', 'bio', 20, 3), s('b2', 'bio', 20, 2), s('b3', 'bio', 20, 1), s('c1', 'chem', 20, 2), s('c2', 'chem', 20, 1), s('n1', null, 20, 1)];
    const { lines } = layoutSky(sessions, subjects, opts);
    expect(lines.map((l) => `${l.from}-${l.to}`)).toEqual(['b1-b2', 'b2-b3', 'c1-c2']);
    expect(lines[0]!.opacity).toBeGreaterThan(lines[2]!.opacity);
  });
  it('keeps only the most recent maxStars sessions and at most 7 links per subject', () => {
    const many = Array.from({ length: 30 }, (_, i) => s(`x${i}`, 'bio', 10, i));
    const out = layoutSky(many, subjects, { ...opts, maxStars: 20 });
    expect(out.stars).toHaveLength(20);
    expect(out.lines.length).toBeLessThanOrEqual(7);
  });
});
