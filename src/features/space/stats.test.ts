import { describe, expect, it } from 'vitest';
import { spaceBlocks, type SpaceStatsRow } from './stats';

const TZ = 'Asia/Manila';
const NOW = new Date('2026-10-08T04:00:00Z');
const row = (id: string, over: Partial<SpaceStatsRow> = {}): SpaceStatsRow => ({
  user_id: id, focus_seconds_total: 7200, focus_seconds_week: 3600, cards_total: 50, cards_week: 10, quizzes_total: 3,
  quizzes_week: 1, achievements: 2, current_streak: 4, longest_streak: 6, last_active_date: '2026-10-08', together_seconds_total: 1800, ...over,
});

describe('spaceBlocks', () => {
  it('a single member has no partner block', () => {
    const b = spaceBlocks([row('me')], { id: 'me', tz: TZ }, null, NOW);
    expect(b.partner).toBeNull();
    expect(b.me).toMatchObject({ streak: 4, weekSeconds: 3600, totalSeconds: 7200, cardsWeek: 10, achievements: 2 });
  });
  it('maps both members and the time spent together', () => {
    const b = spaceBlocks([row('me'), row('p', { focus_seconds_week: 60 })], { id: 'me', tz: TZ }, { id: 'p', tz: TZ }, NOW);
    expect(b.partner?.weekSeconds).toBe(60);
    expect(b.togetherSeconds).toBe(1800);
  });
  it('shows a lapsed streak as 0', () => {
    const b = spaceBlocks([row('me', { last_active_date: '2026-10-05' })], { id: 'me', tz: TZ }, null, NOW);
    expect(b.me?.streak).toBe(0);
  });
});
