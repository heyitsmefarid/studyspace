import { describe, expect, it } from 'vitest';
import { goalProgress, pickCurrentGoals, validateGoal, type GoalLike, type WeekTotals } from './progress';

const weekly = new Map<string, WeekTotals>([
  ['me', { focus_seconds_week: 3 * 3600, cards_week: 40, quizzes_week: 2 }],
  ['p', { focus_seconds_week: 3600, cards_week: 10, quizzes_week: 1 }],
]);
const goal = (over: Partial<GoalLike>): GoalLike => ({ owner_id: 'me', kind: 'weekly_minutes', target: 300, progress: 0, is_shared: false, due_date: null, completed_at: null, ...over });

describe('goalProgress', () => {
  it('counts only the owner for a personal weekly goal', () => {
    expect(goalProgress(goal({}), weekly)).toMatchObject({ value: 180, target: 300, done: false });
    expect(goalProgress(goal({ kind: 'weekly_cards', target: 40 }), weekly)).toMatchObject({ value: 40, done: true, ratio: 1 });
  });
  it('sums both members for a shared goal', () => {
    expect(goalProgress(goal({ is_shared: true, kind: 'weekly_quizzes', target: 5 }), weekly)).toMatchObject({ value: 3, ratio: 0.6 });
  });
  it('uses the stored progress for a custom goal, never below zero', () => {
    expect(goalProgress(goal({ kind: 'custom', target: 10, progress: 4 }), weekly)).toMatchObject({ value: 4, done: false });
    expect(goalProgress(goal({ kind: 'custom', target: 10, progress: -3 }), weekly).value).toBe(0);
  });
});

describe('pickCurrentGoals', () => {
  it('shows up to three unfinished goals, nearest due first, then least complete', () => {
    const goals = [
      { ...goal({ kind: 'custom', target: 10, progress: 9 }), id: 'nearly' },
      { ...goal({ kind: 'custom', target: 10, progress: 1 }), id: 'barely' },
      { ...goal({ kind: 'custom', target: 10, progress: 5, due_date: '2026-10-20' }), id: 'due-later' },
      { ...goal({ kind: 'custom', target: 10, progress: 5, due_date: '2026-10-10' }), id: 'due-soon' },
      { ...goal({ kind: 'custom', target: 10, progress: 10 }), id: 'done' },
    ];
    expect(pickCurrentGoals(goals, (g) => goalProgress(g, weekly)).map((g) => g.id)).toEqual(['due-soon', 'due-later', 'barely']);
  });
});

describe('validateGoal', () => {
  it('needs a name and a whole-number target', () => {
    expect(validateGoal({ title: '  ', kind: 'custom', target: 1, is_shared: false, due_date: null })).toMatchObject({ ok: false, errors: { title: expect.any(String) } });
    expect(validateGoal({ title: 'Read', kind: 'custom', target: 1.5, is_shared: false, due_date: null })).toMatchObject({ ok: false, errors: { target: expect.any(String) } });
  });
  it('trims the name and only keeps a due date on custom goals', () => {
    expect(validateGoal({ title: ' 5 hours ', kind: 'weekly_minutes', target: 300, is_shared: true, due_date: '2026-10-20' }))
      .toEqual({ ok: true, value: { title: '5 hours', kind: 'weekly_minutes', target: 300, is_shared: true, due_date: null } });
  });
});
