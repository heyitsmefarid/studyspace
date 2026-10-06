import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Review P1: the deploy configs had no CSP and nothing stopped the app being framed (clickjacking).
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** Inline classic scripts as the browser hashes them (the HTML parser turns CRLF into LF). */
const inlineScripts = (html: string) => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!.replace(/\r\n?/g, '\n'));
const sha256 = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

function vercelHeaders(): Record<string, string> {
  const v = JSON.parse(read('vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  return Object.fromEntries(v.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]));
}

function netlifyHeaders(): Record<string, string> {
  const lines = read('public/_headers').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '/*');
  const out: Record<string, string> = {};
  for (const l of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(l)) break;
    const i = l.indexOf(':');
    out[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return out;
}

const directive = (csp: string, name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))?.split(/\s+/).slice(1) ?? [];

describe('security headers', () => {
  it('are the same on Vercel and Netlify', () => {
    expect(netlifyHeaders()).toEqual(vercelHeaders());
  });

  it('forbid framing the app', () => {
    const h = vercelHeaders();
    expect(directive(h['Content-Security-Policy']!, 'frame-ancestors')).toEqual(["'none'"]);
    expect(h['X-Frame-Options']).toBe('DENY');
  });

  it('allow the inline theme script by its hash and no other inline script', () => {
    const scripts = inlineScripts(read('index.html'));
    expect(scripts.length).toBeGreaterThan(0);
    const scriptSrc = directive(vercelHeaders()['Content-Security-Policy']!, 'script-src');
    for (const s of scripts) expect(scriptSrc).toContain(sha256(s));
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('only connect to the app itself and Supabase', () => {
    const connect = directive(vercelHeaders()['Content-Security-Policy']!, 'connect-src');
    expect(connect).toEqual(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']);
  });
});
