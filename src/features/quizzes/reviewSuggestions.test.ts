import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  notes: { data: [] as unknown[] | null, error: null as unknown },
  cards: { data: [] as unknown[] | null, error: null as unknown },
  ilike: [] as string[],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async () => db.notes,
    from: () => ({
      select: () => ({
        ilike: (_col: string, pattern: string) => { db.ilike.push(pattern); return { limit: async () => db.cards }; },
      }),
    }),
  },
}));

import { fetchReviewSuggestions } from './api';

const deck = (id: string) => ({ deck_id: id, decks: { id, title: `Deck ${id}` } });

// Review P13: the results page queried Supabase inline and hid failures as "no suggestions".
describe('fetchReviewSuggestions', () => {
  beforeEach(() => {
    db.notes = { data: [], error: null };
    db.cards = { data: [], error: null };
    db.ilike.length = 0;
  });

  it('suggests up to two notes and two distinct decks per topic', async () => {
    db.notes = { data: [{ id: 'n1', title: 'A' }, { id: 'n2', title: 'B' }, { id: 'n3', title: 'C' }], error: null };
    db.cards = { data: [deck('d1'), deck('d1'), deck('d2'), deck('d3')], error: null };
    const [s] = await fetchReviewSuggestions(['Cells']);
    expect(s!.topic).toBe('Cells');
    expect(s!.notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(s!.decks).toEqual([{ id: 'd1', title: 'Deck d1' }, { id: 'd2', title: 'Deck d2' }]);
  });

  it('matches the topic literally, not as a LIKE pattern', async () => {
    await fetchReviewSuggestions(['100%_done']);
    expect(db.ilike).toEqual(['100\\%\\_done']);
  });

  it('surfaces a failed lookup instead of showing no suggestions', async () => {
    db.cards = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
    await expect(fetchReviewSuggestions(['Cells'])).rejects.toThrow();
  });
});
