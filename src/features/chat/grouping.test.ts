import { describe, expect, it } from 'vitest';
import { groupMessages } from './grouping';
import type { ChatMessage } from './types';

const TZ = 'Asia/Manila';
const m = (id: string, sender: string, at: string): ChatMessage => ({
  id, room_id: 'r', sender_id: sender, kind: 'text', body: id, attachment_path: null, attachment_name: null,
  attachment_mime: null, deleted_at: null, created_at: at, reactions: [],
});

describe('groupMessages', () => {
  it('starts a new day at local midnight in the viewer timezone', () => {
    const days = groupMessages([m('a', 'x', '2026-10-05T15:59:00Z'), m('b', 'x', '2026-10-05T16:01:00Z')], TZ, new Date('2026-10-06T02:00:00Z'));
    expect(days.map((d) => d.label)).toEqual(['Yesterday', 'Today']);
  });
  it('clusters the same sender within 5 minutes and splits on a gap or a new sender', () => {
    const days = groupMessages([
      m('a', 'x', '2026-10-06T01:00:00Z'), m('b', 'x', '2026-10-06T01:04:00Z'),
      m('c', 'x', '2026-10-06T01:10:00Z'), m('d', 'y', '2026-10-06T01:11:00Z'),
    ], TZ, new Date('2026-10-06T02:00:00Z'));
    expect(days[0]!.clusters.map((c) => c.messages.map((x) => x.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });
});
