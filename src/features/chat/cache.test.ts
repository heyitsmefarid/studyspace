import { describe, expect, it } from 'vitest';
import { applyReaction, dropMessage, flatten, upsertMessage, type MessagePages } from './cache';
import type { ChatMessage } from './types';

const m = (id: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id, room_id: 'r', sender_id: 'x', kind: 'text', body: id, attachment_path: null, attachment_name: null,
  attachment_mime: null, deleted_at: null, created_at: '2026-10-06T01:00:00Z', reactions: [], ...over,
});
const pages = (...p: ChatMessage[][]): MessagePages => ({ pages: p, pageParams: p.map(() => null) });

describe('chat cache', () => {
  it('puts a new message at the newest end', () => {
    expect(flatten(upsertMessage(pages([m('b'), m('a')]), m('c'))).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('the confirmed row replaces the pending bubble', () => {
    const sent = upsertMessage(pages([m('a')]), m('n', { pending: 'sending' }));
    const confirmed = flatten(upsertMessage(sent, m('n')));
    expect(confirmed.filter((x) => x.id === 'n')).toHaveLength(1);
    expect(confirmed.at(-1)!.pending).toBeUndefined();
  });
  it('a live insert of a known id does not duplicate it', () => {
    const once = upsertMessage(pages([m('a')]), m('b'));
    expect(flatten(upsertMessage(once, m('b')))).toHaveLength(2);
  });
  it('a live update keeps the reactions already loaded', () => {
    const withReaction = pages([m('a', { reactions: [{ user_id: 'y', emoji: '🔥' }] })]);
    const deleted = flatten(upsertMessage(withReaction, m('a', { deleted_at: 'now', body: '' })))[0]!;
    expect(deleted.deleted_at).toBe('now');
    expect(deleted.reactions).toEqual([{ user_id: 'y', emoji: '🔥' }]);
  });
  it('adds a reaction once and removes it', () => {
    const r = { message_id: 'a', user_id: 'y', emoji: '🔥' };
    const added = applyReaction(applyReaction(pages([m('a')]), r, 'add'), r, 'add');
    expect(flatten(added)[0]!.reactions).toHaveLength(1);
    expect(flatten(applyReaction(added, r, 'remove'))[0]!.reactions).toHaveLength(0);
  });
  it('drops a discarded message and leaves an empty cache alone', () => {
    expect(flatten(dropMessage(pages([m('a'), m('b')]), 'a')).map((x) => x.id)).toEqual(['b']);
    expect(upsertMessage(undefined, m('a'))).toBeUndefined();
  });
});
