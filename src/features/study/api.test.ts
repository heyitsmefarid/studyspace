import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  inserted: [] as unknown[],
  existing: null as unknown,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      insert: (row: unknown) => { db.inserted.push(row); return { select: () => ({ single: db.insert }) }; },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: db.existing, error: null }) }) }),
    }),
  },
}));

import { saveStudySession } from './api';

const input = {
  id: '11111111-1111-4111-8111-111111111111', subjectId: null, taskId: null, mode: 'custom' as const,
  startedAt: '2026-10-06T10:00:00.000Z', endedAt: '2026-10-06T10:30:00.000Z', focusSeconds: 1800,
  cardsStudied: 0, questionsAnswered: 0, correctAnswers: 0,
};

describe('saveStudySession (review I1)', () => {
  beforeEach(() => { db.inserted.length = 0; db.existing = null; db.insert.mockReset(); });

  it('inserts with the client-generated session id', async () => {
    db.insert.mockResolvedValue({ data: { id: input.id }, error: null });
    await saveStudySession(input);
    expect(db.inserted[0]).toMatchObject({ id: input.id, user_id: 'u1', focus_seconds: 1800 });
  });

  it('treats a retry whose first insert already landed as saved', async () => {
    db.insert.mockResolvedValue({ data: null, error: { code: '23514', message: 'This session overlaps another of your sessions.' } });
    db.existing = { id: input.id };
    await expect(saveStudySession(input)).resolves.toEqual({ id: input.id });
  });

  it("surfaces the server's reason when the session really can't be saved", async () => {
    db.insert.mockResolvedValue({ data: null, error: { code: '23514', message: 'Study sessions must be saved within a day of finishing.' } });
    await expect(saveStudySession(input)).rejects.toThrow('Study sessions must be saved within a day of finishing.');
  });
});
