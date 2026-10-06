import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('motion foundation', () => {
  it.each(['page-in', 'rise-in', 'pop-in', 'pop-out', 'fade-in', 'fade-out', 'sheet-up', 'sheet-down', 'slide-in-right', 'slide-out-right',
    'slide-in-left', 'slide-out-left', 'shake', 'float', 'shimmer', 'grow-x', 'draw-line', 'pulse-once', 'orbit-spin', 'shimmer-text'])(
    'defines @keyframes %s and an animate utility', (name) => {
      expect(css).toMatch(new RegExp(String.raw`@keyframes ${name}\s*\{`));
    });

  it('reduced motion collapses every animation and transition', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toContain('animation-duration: 0.01ms !important');
    expect(block).toContain('animation-iteration-count: 1 !important');
    expect(block).toContain('animation-delay: 0ms !important');
    expect(block).toContain('transition-duration: 0.01ms !important');
  });

  it('stagger caps at the 12th child', () => {
    expect(css).toMatch(/\.stagger > \*\s*\{[^}]*--i:\s*11/);
    expect(css).toMatch(/\.stagger > :nth-child\(11\)\s*\{\s*--i:\s*10;?\s*\}/);
    expect(css).not.toMatch(/\.stagger > :nth-child\(1[3-9]\)/);
  });

  // Entrances must hand back to the element's own styles (e.g. a done task chip at opacity .6), so they fill backwards.
  it.each(['page-in', 'rise-in', 'pop-in', 'fade-in', 'sheet-up', 'slide-in-right', 'slide-in-left', 'grow-x', 'draw-line'])(
    'entrance %s fills backwards, not both', (name) => {
      expect(css).toMatch(new RegExp(String.raw`--animate-${name}: ${name} [^;]*backwards;`));
    });
  // Final review I2: transform/filter on the page wrapper makes it the containing block for position:fixed
  // descendants (study runner, jump-to-latest pill), clipping them while it runs. The page entrance is opacity only.
  it('page entrance animates opacity only', () => {
    const body = /@keyframes page-in\s*\{([\s\S]*?)\}\s*\}/.exec(css)?.[1] ?? '';
    expect(body).toContain('opacity');
    expect(body).not.toMatch(/transform|filter|translate|scale/);
  });

  it('stagger entrance fills backwards', () => {
    expect(css).toMatch(/\.stagger > \*\s*\{[^}]*animation: rise-in [^;]*backwards;/);
  });
});
