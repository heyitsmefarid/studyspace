import { describe, expect, it } from 'vitest';
import { markRead, prependUnique, removeById } from './cache';

const n = (id: string, read_at: string | null = null) => ({ id, read_at });

describe('notification cache helpers', () => {
  it('prepends a new notification once', () => {
    const list = [n('a')];
    expect(prependUnique(list, n('b')).map((x) => x.id)).toEqual(['b', 'a']);
    expect(prependUnique(list, n('a'))).toBe(list);
  });
  it('marks chosen or all unread items read, leaving read ones alone', () => {
    const list = [n('a'), n('b', 'earlier'), n('c')];
    expect(markRead(list, ['a'], 'now').map((x) => x.read_at)).toEqual(['now', 'earlier', null]);
    expect(markRead(list, 'all', 'now').map((x) => x.read_at)).toEqual(['now', 'earlier', 'now']);
  });
  it('removes by id', () => {
    expect(removeById([n('a'), n('b')], 'a').map((x) => x.id)).toEqual(['b']);
  });
});
