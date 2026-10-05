import { describe, expect, it } from 'vitest';
import { excerpt, truncateAtBoundary } from './text';

describe('truncateAtBoundary', () => {
  it('returns short text unchanged', () => {
    expect(truncateAtBoundary('abc', 10)).toEqual({ text: 'abc', truncated: false });
  });
  it('cuts at the last paragraph break before max', () => {
    expect(truncateAtBoundary('para one.\n\npara two is long', 15)).toEqual({ text: 'para one.', truncated: true });
  });
  it('falls back to a line break, then a hard cut', () => {
    expect(truncateAtBoundary('line one\nline two', 12)).toEqual({ text: 'line one', truncated: true });
    expect(truncateAtBoundary('abcdefghij', 4)).toEqual({ text: 'abcd', truncated: true });
  });
});

describe('excerpt', () => {
  it('collapses whitespace and adds an ellipsis', () => {
    expect(excerpt('a\n\n b   c', 140)).toBe('a b c');
    expect(excerpt('x'.repeat(200), 10)).toBe('xxxxxxxxx…');
  });
});
