import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ calls: [] as string[], upsert: vi.fn(), del: vi.fn(), touch: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (rows: unknown, opts: unknown) => { db.calls.push(`${table}.upsert`); return db.upsert(rows, opts); },
      delete: () => {
        db.calls.push(`${table}.delete`);
        const chain = { eq: (...a: unknown[]) => { db.del('eq', ...a); return chain; }, not: (...a: unknown[]) => { db.del('not', ...a); return chain; }, then: (r: (v: unknown) => void) => r({ error: null }) };
        return chain;
      },
      update: () => ({ eq: async () => { db.calls.push(`${table}.update`); return db.touch(); } }),
    }),
  },
}));

import { saveQuizQuestions } from './api';

const q = (id: string, question: string) => ({
  id, type: 'mcq' as const, question, options: ['A', 'B'], correct_answer: 'A', explanation: '', topic: '', difficulty: undefined,
});
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

// Review I4: upsert by stable id first (one statement), then remove only the questions that were deleted —
// a failure can never leave the quiz empty, and attempts in progress keep their question ids.
describe('saveQuizQuestions', () => {
  beforeEach(() => { db.calls.length = 0; db.upsert.mockReset(); db.del.mockReset(); db.touch.mockReset(); db.touch.mockResolvedValue({ error: null }); });

  it('upserts with stable ids and positions before deleting only removed questions', async () => {
    db.upsert.mockResolvedValue({ error: null });
    await saveQuizQuestions('quiz-1', [q(A, 'First?'), q(B, 'Second?')]);
    expect(db.calls).toEqual(['quiz_questions.upsert', 'quiz_questions.delete', 'quizzes.update']);
    const [rows, opts] = db.upsert.mock.calls[0]!;
    expect(opts).toEqual({ onConflict: 'id' });
    expect(rows).toEqual([
      { id: A, quiz_id: 'quiz-1', type: 'mcq', question: 'First?', options: ['A', 'B'], correct_answer: 'A', explanation: '', topic: null, difficulty: null, position: 0 },
      { id: B, quiz_id: 'quiz-1', type: 'mcq', question: 'Second?', options: ['A', 'B'], correct_answer: 'A', explanation: '', topic: null, difficulty: null, position: 1 },
    ]);
    expect(db.del).toHaveBeenCalledWith('eq', 'quiz_id', 'quiz-1');
    expect(db.del).toHaveBeenCalledWith('not', 'id', 'in', `(${A},${B})`);
  });

  it('stops before deleting anything when the upsert fails', async () => {
    db.upsert.mockResolvedValue({ error: { code: '42501', message: 'new row violates row-level security policy' } });
    await expect(saveQuizQuestions('quiz-1', [q(A, 'First?')])).rejects.toThrow("You don't have permission to do that.");
    expect(db.calls).toEqual(['quiz_questions.upsert']);
  });
});
