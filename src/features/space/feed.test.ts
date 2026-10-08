import { describe, expect, it } from 'vitest';
import { describeFeedItem, type FeedItem } from './feed';

const item = (over: Partial<FeedItem>): FeedItem => ({ kind: 'session', user_id: 'u', at: '2026-10-08T01:00:00Z', ref_id: 'r1', title: 'Biology', detail: {}, ...over });

describe('describeFeedItem', () => {
  it('describes sessions, marking ones studied together', () => {
    expect(describeFeedItem(item({ detail: { minutes: 25, together: true } }), 'You').text).toBe('You studied Biology for 25 min together ✦');
  });
  it('shows quiz accuracy only', () => {
    expect(describeFeedItem(item({ kind: 'quiz', title: 'Quiz', detail: { accuracy: 0.85 } }), 'Ana').text).toBe('Ana finished a quiz · 85%');
  });
  it('links shared items', () => {
    expect(describeFeedItem(item({ kind: 'shared_note', title: 'Cells' }), 'Ana')).toEqual({ text: 'Ana shared “Cells”', href: '/notes/r1' });
    expect(describeFeedItem(item({ kind: 'shared_deck', title: 'Verbs' }), 'Ana').href).toBe('/decks/r1');
  });
  it('names unlocked achievements', () => {
    expect(describeFeedItem(item({ kind: 'achievement', title: 'Binary Star', ref_id: null }), 'Ana').text).toBe('Ana unlocked Binary Star');
  });
});
