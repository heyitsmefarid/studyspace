import { describe, expect, it, vi } from 'vitest';
import { installParallax, parallaxVector } from './parallax';

describe('parallaxVector', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  it('is zero at the centre and ±1 at the edges', () => {
    expect(parallaxVector(rect, 200, 100)).toEqual({ x: 0, y: 0 });
    expect(parallaxVector(rect, 100, 50)).toEqual({ x: -1, y: -1 });
    expect(parallaxVector(rect, 300, 150)).toEqual({ x: 1, y: 1 });
  });
  it('clamps a pointer outside the element', () => {
    expect(parallaxVector(rect, 900, -400)).toEqual({ x: 1, y: -1 });
  });
});

describe('installParallax', () => {
  it('does nothing without hover (touch-only devices) or with reduced motion', () => {
    const add = vi.fn();
    const fake = (hover: boolean, reduce: boolean) => ({
      matchMedia: (q: string) => ({ matches: q.includes('hover') ? hover : reduce }),
      document: { addEventListener: add, removeEventListener: vi.fn() },
      requestAnimationFrame: vi.fn(), cancelAnimationFrame: vi.fn(),
    }) as unknown as Window;
    const el = { style: { setProperty: vi.fn() }, getBoundingClientRect: vi.fn() } as unknown as HTMLElement;
    installParallax(el, fake(false, false))();
    installParallax(el, fake(true, true))();
    expect(add).not.toHaveBeenCalled();
    installParallax(el, fake(true, false))();
    expect(add).toHaveBeenCalledWith('pointermove', expect.any(Function), { passive: true });
  });
});
