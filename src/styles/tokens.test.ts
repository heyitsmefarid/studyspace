import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1]!, m[2]!]));
}
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

const TEXT = ['ink', 'ink-muted', 'ink-faint', 'primary', 'gold', 'teal', 'coral', 'star-me', 'star-partner'];
const SURFACES = ['bg', 'surface', 'surface-2'];

describe.each([
  ['daybreak', ':root'],
  ['night', '[data-theme="night"]'],
])('%s tokens', (_name, selector) => {
  const t = block(selector);
  it.each(TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg])))('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it('primary-ink on primary ≥ 4.5:1', () => {
    expect(ratio(t['primary-ink']!, t['primary']!)).toBeGreaterThanOrEqual(4.5);
  });
});

// Chart marks (validated with the dataviz palette script: band, chroma, CVD and contrast) need ≥ 3:1 on chart surfaces.
describe.each([
  ['daybreak', ':root'],
  ['night', '[data-theme="night"]'],
])('%s chart tokens', (_name, selector) => {
  const t = block(selector);
  it.each(['chart-1', 'chart-2'].flatMap((fg) => ['surface', 'surface-2'].map((bg) => [fg, bg])))('%s on %s ≥ 3:1', (fg, bg) => {
    expect(t[fg], `${fg} missing`).toBeDefined();
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(3);
  });
});
