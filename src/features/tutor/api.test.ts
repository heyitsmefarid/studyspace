import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  calls: [] as unknown[][],
  messages: [] as { id: string }[],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        order: (col: string, opts?: unknown) => { db.calls.push([table, 'order', col, opts]); return q; },
        limit: async (n: number) => { db.calls.push([table, 'limit', n]); return { data: db.messages, error: null }; },
        single: async () => ({ data: { id: 'conv' }, error: null }),
      };
      return q;
    },
  },
}));

import { fetchConversation, MESSAGE_WINDOW } from './api';

// Review P6: long conversations loaded the OLDEST 500 messages, so the newest replies never appeared.
describe('fetchConversation', () => {
  beforeEach(() => { db.calls.length = 0; });

  it('loads the newest messages and shows them oldest-first', async () => {
    db.messages = [{ id: 'm3' }, { id: 'm2' }, { id: 'm1' }];
    const { messages } = await fetchConversation('conv');
    expect(db.calls).toEqual([
      ['ai_messages', 'order', 'created_at', { ascending: false }],
      ['ai_messages', 'limit', MESSAGE_WINDOW],
    ]);
    expect(messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });
});
