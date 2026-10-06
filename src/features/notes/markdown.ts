import type { JSONContent } from '@tiptap/react';

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(text: string): JSONContent[] {
  const out: JSONContent[] = [];
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) out.push({ type: 'text', text: part.slice(2, -2), marks: [{ type: 'bold' }] });
    else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) out.push({ type: 'text', text: part.slice(1, -1), marks: [{ type: 'code' }] });
    else if (/^\[[^\]]+\]\([^)\s]+\)$/.test(part)) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)!;
      out.push(/^(https?:|mailto:)/i.test(href!) ? { type: 'text', text: label!, marks: [{ type: 'link', attrs: { href } }] } : { type: 'text', text: label! });
    } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      out.push({ type: 'text', text: part.slice(1, -1), marks: [{ type: 'italic' }] });
    } else out.push({ type: 'text', text: part });
  }
  return out;
}

const para = (t: string): JSONContent => ({ type: 'paragraph', content: inline(t) });

export function markdownToTiptap(md: string): JSONContent[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: JSONContent[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }
    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) code.push(lines[i++]!);
      i++;
      blocks.push({ type: 'codeBlock', content: code.length ? [{ type: 'text', text: code.join('\n') }] : [] });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ type: 'heading', attrs: { level: Math.min(3, h[1]!.length) }, content: inline(h[2]!.trim()) }); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push({ type: 'horizontalRule' }); i++; continue; }
    if (/^\s*[-*+]\s+\[( |x|X)\]\s+/.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && /^\s*[-*+]\s+\[( |x|X)\]\s+/.test(lines[i]!)) {
        const m = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(lines[i++]!)!;
        items.push({ type: 'taskItem', attrs: { checked: m[1] !== ' ' }, content: [para(m[2]!)] });
      }
      blocks.push({ type: 'taskList', content: items });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!) && !/^\s*[-*+]\s+\[( |x|X)\]/.test(lines[i]!)) {
        items.push({ type: 'listItem', content: [para(lines[i++]!.replace(/^\s*[-*+]\s+/, ''))] });
      }
      blocks.push({ type: 'bulletList', content: items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push({ type: 'listItem', content: [para(lines[i++]!.replace(/^\s*\d+[.)]\s+/, ''))] });
      blocks.push({ type: 'orderedList', content: items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) quote.push(lines[i++]!.replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'blockquote', content: [para(quote.join(' '))] });
      continue;
    }
    const text: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|\s*>)/.test(lines[i]!)) text.push(lines[i++]!.trim());
    if (text.length === 0) text.push(lines[i++]!.trim()); // never stall on an unexpected line
    blocks.push(para(text.join(' ')));
  }
  return blocks;
}
