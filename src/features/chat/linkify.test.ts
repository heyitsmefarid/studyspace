import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('turns http(s) URLs into links and leaves trailing punctuation outside', () => {
    expect(linkify('see https://example.com/a.')).toEqual([
      { type: 'text', text: 'see ' },
      { type: 'link', text: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', text: '.' },
    ]);
  });
  it('never links other schemes', () => {
    expect(linkify('javascript:alert(1)')).toEqual([{ type: 'text', text: 'javascript:alert(1)' }]);
    expect(linkify('data:text/html,hi')).toEqual([{ type: 'text', text: 'data:text/html,hi' }]);
  });
  it('keeps HTML as plain text', () => {
    const evil = '<img src=x onerror=alert(1)>';
    expect(linkify(evil)).toEqual([{ type: 'text', text: evil }]);
  });
  it('handles empty text and upper-case schemes', () => {
    expect(linkify('')).toEqual([]);
    expect(linkify('HTTPS://EXAMPLE.COM')).toEqual([{ type: 'link', text: 'HTTPS://EXAMPLE.COM', href: 'https://example.com/' }]);
  });
});
