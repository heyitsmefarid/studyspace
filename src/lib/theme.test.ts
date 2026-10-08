import { describe, expect, it, vi } from 'vitest';
import { accountTheme, applyTheme, oppositeTheme, readThemePref, resolveTheme, subscribeTheme, switchTheme, watchSystemTheme, type ThemePref } from './theme';

describe('resolveTheme', () => {
  it('follows the OS for system', () => {
    expect(resolveTheme('system', true)).toBe('night');
    expect(resolveTheme('system', false)).toBe('daybreak');
  });
  it('honours explicit choices', () => {
    expect(resolveTheme('night', false)).toBe('night');
    expect(resolveTheme('daybreak', true)).toBe('daybreak');
  });
});

/** A window with a switchable dark-mode media query, a theme root and storage; enough for theme.ts. */
function fakeWindow({ dark = false, reduce = false, stored, viewTransitions = false }: {
  dark?: boolean; reduce?: boolean; stored?: ThemePref; viewTransitions?: boolean;
} = {}) {
  const darkListeners = new Set<() => void>();
  const darkQuery = {
    matches: dark,
    addEventListener: (_type: string, cb: () => void) => darkListeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => darkListeners.delete(cb),
  };
  const store = new Map<string, string>(stored ? [['ss.theme', JSON.stringify(stored)]] : []);
  const root = { dataset: {} as Record<string, string>, classList: { add: vi.fn(), remove: vi.fn() }, animate: vi.fn() };
  // Like the real API, the update runs later (after the old view is captured); runUpdate() stands in for that moment.
  let pending: (() => void) | null = null;
  const startViewTransition = vi.fn((update: () => void) => {
    let markDone!: () => void;
    const updateCallbackDone = new Promise<void>((resolve) => { markDone = resolve; });
    pending = () => { update(); markDone(); };
    return { updateCallbackDone, ready: updateCallbackDone, finished: updateCallbackDone };
  });
  const runUpdate = () => pending?.();
  const win = {
    innerWidth: 1000, innerHeight: 800,
    matchMedia: (q: string) => (q.includes('reduced-motion') ? { matches: reduce } : darkQuery),
    document: {
      documentElement: root,
      querySelector: () => ({ setAttribute: vi.fn() }),
      ...(viewTransitions ? { startViewTransition } : {}),
    },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
  } as unknown as Window;
  const setDark = (d: boolean) => { darkQuery.matches = d; darkListeners.forEach((cb) => cb()); };
  return { win, root, store, setDark, darkListeners, startViewTransition, runUpdate };
}

describe('applyTheme', () => {
  it('sets the resolved theme, remembers the choice and tells subscribers', () => {
    const { win, root } = fakeWindow({ dark: true });
    const seen = vi.fn();
    const unsubscribe = subscribeTheme(seen);
    expect(applyTheme('system', win)).toBe('night');
    expect(root.dataset.theme).toBe('night');
    expect(readThemePref(win)).toBe('system');
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
    applyTheme('daybreak', win);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe('oppositeTheme', () => {
  it('flips night and daybreak', () => {
    expect(oppositeTheme('night')).toBe('daybreak');
    expect(oppositeTheme('daybreak')).toBe('night');
  });
});

describe('watchSystemTheme', () => {
  it('re-applies the theme live when the device switches while the choice is System', () => {
    const { win, root, setDark } = fakeWindow({ dark: false, stored: 'system' });
    applyTheme('system', win);
    const stop = watchSystemTheme(win);
    setDark(true);
    expect(root.dataset.theme).toBe('night');
    setDark(false);
    expect(root.dataset.theme).toBe('daybreak');
    stop();
  });
  it('leaves an explicit choice alone', () => {
    const { win, root, setDark } = fakeWindow({ dark: false });
    applyTheme('daybreak', win);
    const stop = watchSystemTheme(win);
    setDark(true);
    expect(root.dataset.theme).toBe('daybreak');
    stop();
  });
  it('stops listening when cleaned up', () => {
    const { win, darkListeners } = fakeWindow();
    const stop = watchSystemTheme(win);
    expect(darkListeners.size).toBe(1);
    stop();
    expect(darkListeners.size).toBe(0);
  });
});

describe('switchTheme', () => {
  it('applies at once where view transitions are unsupported', () => {
    const { win, root } = fakeWindow();
    switchTheme('night', { x: 10, y: 10 }, win);
    expect(root.dataset.theme).toBe('night');
  });
  it('resolves only once the new theme is on screen', async () => {
    const { win, root, runUpdate } = fakeWindow({ viewTransitions: true });
    let resolved = false;
    const done = switchTheme('night', undefined, win).then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    runUpdate();
    await done;
    expect(root.dataset.theme).toBe('night');
  });
  it('applies inside a view transition and sweeps a circle out from the origin', async () => {
    const { win, root, startViewTransition, runUpdate } = fakeWindow({ viewTransitions: true });
    const done = switchTheme('night', { x: 10, y: 20 }, win);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    runUpdate();
    await done;
    await Promise.resolve();
    expect(root.dataset.theme).toBe('night');
    expect(root.animate).toHaveBeenCalledWith(
      { clipPath: ['circle(0px at 10px 20px)', expect.stringMatching(/^circle\(\d+px at 10px 20px\)$/)] },
      expect.objectContaining({ pseudoElement: '::view-transition-new(root)' }),
    );
  });
  it('skips the transition with reduced motion', () => {
    const { win, root, startViewTransition } = fakeWindow({ viewTransitions: true, reduce: true });
    switchTheme('night', { x: 10, y: 20 }, win);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(root.dataset.theme).toBe('night');
  });
});

describe('accountTheme', () => {
  it('uses the theme saved on the account', () => {
    expect(accountTheme({ theme: 'daybreak' }, 'night')).toEqual({ pref: 'daybreak', adopt: false });
    expect(accountTheme({ theme: 'system' }, 'night')).toEqual({ pref: 'system', adopt: false });
  });
  it("adopts this device's explicit choice when the account has never saved one", () => {
    expect(accountTheme({}, 'night')).toEqual({ pref: 'night', adopt: true });
    expect(accountTheme(null, 'daybreak')).toEqual({ pref: 'daybreak', adopt: true });
  });
  it('has nothing to adopt when this device follows the system', () => {
    expect(accountTheme({}, 'system')).toEqual({ pref: 'system', adopt: false });
  });
});
