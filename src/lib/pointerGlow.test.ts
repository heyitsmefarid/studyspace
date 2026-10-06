import { describe, expect, it, vi } from 'vitest';
import { glowPosition, installPointerGlow } from './pointerGlow';

describe('pointer glow', () => {
  it('converts the pointer to element-relative pixels', () => {
    expect(glowPosition({ left: 100, top: 40 }, 150, 70)).toEqual({ mx: '50px', my: '30px' });
  });
  it('does nothing without hover (touch-only devices) or with reduced motion', () => {
    const add = vi.fn();
    const fake = (hover: boolean, reduce: boolean) => ({
      matchMedia: (q: string) => ({ matches: q.includes('hover') ? hover : reduce }),
      document: { addEventListener: add, removeEventListener: vi.fn() },
      requestAnimationFrame: vi.fn(), cancelAnimationFrame: vi.fn(),
    }) as unknown as Window;
    installPointerGlow(fake(false, false))();
    installPointerGlow(fake(true, true))();
    expect(add).not.toHaveBeenCalled();
    installPointerGlow(fake(true, false))();
    expect(add).toHaveBeenCalledWith('pointermove', expect.any(Function), { passive: true });
  });
});
