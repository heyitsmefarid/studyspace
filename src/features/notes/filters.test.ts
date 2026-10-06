import { describe, expect, it } from 'vitest';
import { applyLocalFilters, sortNotes, type NoteListItem } from './filters';

const n = (id: string, over: Partial<NoteListItem> = {}): NoteListItem => ({
  id, owner_id: 'me', title: id, subject_id: null, folder_id: null, is_pinned: false, is_favorite: false,
  is_shared: false, updated_at: '2026-10-01T00:00:00Z', excerpt: '', ...over,
});

describe('notes filters', () => {
  it('puts pinned first then newest', () => {
    const out = sortNotes([n('a', { updated_at: '2026-10-03T00:00:00Z' }), n('b', { is_pinned: true }), n('c', { updated_at: '2026-10-05T00:00:00Z' })]);
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('separates mine from shared-with-me and applies flags', () => {
    const items = [n('mine'), n('theirs', { owner_id: 'p', is_shared: true }), n('fav', { is_favorite: true })];
    expect(applyLocalFilters(items, { scope: 'shared' }, 'me').map((x) => x.id)).toEqual(['theirs']);
    expect(applyLocalFilters(items, { scope: 'mine', favorite: true }, 'me').map((x) => x.id)).toEqual(['fav']);
  });
});
