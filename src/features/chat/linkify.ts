export type Segment = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[.,;:!?)\]}]+$/;

/** Splits plain text into text and http(s) link segments. Nothing is ever treated as HTML. */
export function linkify(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0].replace(TRAILING, '');
    const start = match.index;
    let href: string | null = null;
    try {
      const url = new URL(raw);
      if (url.protocol === 'http:' || url.protocol === 'https:') href = url.href;
    } catch {
      href = null;
    }
    if (!href) continue;
    if (start > last) out.push({ type: 'text', text: text.slice(last, start) });
    out.push({ type: 'link', text: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}
