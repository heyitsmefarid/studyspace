import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPLASH_VIDEO, markSplashPlayed, shouldPlaySplash } from './splashGate';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('splash', () => {
  it('plays once per session', () => {
    const s = memory();
    expect(shouldPlaySplash(s, false)).toBe(true);
    markSplashPlayed(s);
    expect(shouldPlaySplash(s, false)).toBe(false);
  });
  it('never plays with reduced motion', () => {
    expect(shouldPlaySplash(memory(), true)).toBe(false);
  });
  it('stays out of the way when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(shouldPlaySplash(blocked, false)).toBe(false);
    expect(() => markSplashPlayed(blocked)).not.toThrow();
  });
  // The SPA rewrite must not turn the videos into index.html on Vercel.
  it('serves the intro videos as files', () => {
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string }[] };
    for (const path of Object.values(SPLASH_VIDEO)) {
      expect(existsSync(new URL(`../../public${path}`, import.meta.url)), path).toBe(true);
      for (const r of vercel.rewrites) expect(new RegExp(`^${r.source}$`).test(path), `${r.source} rewrites ${path}`).toBe(false);
    }
  });
});
