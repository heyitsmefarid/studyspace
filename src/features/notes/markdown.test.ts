import { describe, expect, it } from 'vitest';
import { markdownToTiptap } from './markdown';

describe('markdownToTiptap', () => {
  it('converts headings, paragraphs and rules', () => {
    expect(markdownToTiptap('# Title\n\nHello world\n\n---\n#### Deep')).toEqual([
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      { type: 'horizontalRule' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Deep' }] },
    ]);
  });
  it('converts bullet, ordered and task lists', () => {
    const [ul, ol, tl] = markdownToTiptap('- a\n- b\n\n1. one\n2. two\n\n- [ ] todo\n- [x] done');
    expect(ul).toMatchObject({ type: 'bulletList', content: [{ type: 'listItem' }, { type: 'listItem' }] });
    expect(ol).toMatchObject({ type: 'orderedList', content: [{ type: 'listItem' }, { type: 'listItem' }] });
    expect(tl).toMatchObject({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false } }, { type: 'taskItem', attrs: { checked: true } }] });
  });
  it('converts inline bold, italic, code and safe links; unsafe links stay text', () => {
    const [p] = markdownToTiptap('**Bold** and *it* and `x` and [site](https://a.dev) and [bad](javascript:alert)');
    expect(p!.content).toEqual([
      { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'it', marks: [{ type: 'italic' }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'x', marks: [{ type: 'code' }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'site', marks: [{ type: 'link', attrs: { href: 'https://a.dev' } }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'bad' },
    ]);
  });
  it('keeps fenced code blocks and quotes', () => {
    expect(markdownToTiptap('```\nconst x = 1;\n```\n\n> quoted')).toEqual([
      { type: 'codeBlock', content: [{ type: 'text', text: 'const x = 1;' }] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] }] },
    ]);
  });
});
