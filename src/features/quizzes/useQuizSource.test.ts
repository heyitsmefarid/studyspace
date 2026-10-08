import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ timeLimitSeconds: null as number | null }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const data = table === 'quizzes'
        ? { id: 'quiz-1', title: 'Biology', subject_id: null, time_limit_seconds: db.timeLimitSeconds }
        : [{ id: 'q1', type: 'tf', question: 'Cells are alive.', options: ['True', 'False'], correct_answer: 'True', explanation: '', difficulty: null, topic: null }];
      const chain = {
        select: () => chain, eq: () => chain, order: () => chain, single: () => chain,
        then: (resolve: (result: unknown) => void) => resolve({ data, error: null }),
      };
      return chain;
    },
  },
}));

import { resolveQuizSource } from './useQuizSource';

describe('quiz URL timer', () => {
  beforeEach(() => { db.timeLimitSeconds = null; });

  it.each(['Infinity', '-Infinity', 'NaN', 'nope', '-5', '0', '', '1e309'])('uses the timed quiz default for invalid minutes=%s', async (minutes) => {
    const source = await resolveQuizSource(new URLSearchParams({ mode: 'timed', minutes }), 'quiz-1');
    expect(source.timeLimitSeconds).toBe(60);
  });

  it.each([['0.5', 60], ['2.5', 150], ['240', 14400], ['999999999', 14400]])('bounds minutes=%s to a usable timer', async (minutes, seconds) => {
    const source = await resolveQuizSource(new URLSearchParams({ mode: 'timed', minutes }), 'quiz-1');
    expect(source.timeLimitSeconds).toBe(seconds);
  });

  it('uses the saved limit when the URL override is invalid', async () => {
    db.timeLimitSeconds = 300;
    const source = await resolveQuizSource(new URLSearchParams({ mode: 'timed', minutes: '-10' }), 'quiz-1');
    expect(source.timeLimitSeconds).toBe(300);
  });

  it('does not add a timer to practice mode', async () => {
    const source = await resolveQuizSource(new URLSearchParams({ mode: 'practice', minutes: '15' }), 'quiz-1');
    expect(source.timeLimitSeconds).toBeNull();
  });
});
