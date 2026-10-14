import { useSyncExternalStore } from 'react';
import { prefersReducedMotion } from './motion';

export type ThemePref = 'system' | 'night' | 'daybreak' | 'sunset';
export type Theme = 'night' | 'daybreak' | 'sunset';

const THEMES: readonly Theme[] = ['night', 'daybreak', 'sunset'];
/** Browser chrome colour (meta theme-color) per theme: each theme's page background. */
const CHROME: Record<Theme, string> = { night: '#0B1026', daybreak: '#F6F3FB', sunset: '#1C1220' };

/** Night and Sunset are dark themes; Daybreak is the light one. */
export const isDarkTheme = (theme: Theme): boolean => theme !== 'daybreak';

const KEY = 'ss.theme';
const DARK = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

export function resolveTheme(pref: ThemePref, prefersDark: boolean): Theme {
  if (pref === 'system') return prefersDark ? 'night' : 'daybreak';
  return pref;
}

const isTheme = (v: unknown): v is Theme => (THEMES as readonly unknown[]).includes(v);
const isPref = (v: unknown): v is ThemePref => v === 'system' || isTheme(v);

export function readThemePref(win: Window = window): ThemePref {
  try {
    const v: unknown = JSON.parse(win.localStorage.getItem(KEY) ?? '"system"');
    return isPref(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

/** The quick toggle flips light and dark: Daybreak goes to Night, and either dark theme goes to Daybreak. */
export function oppositeTheme(theme: Theme): Theme {
  return isDarkTheme(theme) ? 'daybreak' : 'night';
}

/** Subscribers hear every applyTheme, so toggles, Settings and the palette stay in sync. */
export function subscribeTheme(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function applyTheme(pref: ThemePref, win: Window = window): Theme {
  const theme = resolveTheme(pref, win.matchMedia(DARK).matches);
  win.document.documentElement.dataset.theme = theme;
  win.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[theme]);
  try { win.localStorage.setItem(KEY, JSON.stringify(pref)); } catch { /* storage unavailable */ }
  listeners.forEach((cb) => cb());
  return theme;
}

/** While the choice is System, follow the device the moment it switches between light and dark. */
export function watchSystemTheme(win: Window = window): () => void {
  const mq = win.matchMedia(DARK);
  const onChange = () => { if (readThemePref(win) === 'system') applyTheme('system', win); };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * Apply a theme with a View Transition: from `origin` (the toggle) the new theme sweeps out in a growing circle,
 * otherwise it cross-fades. Instant where unsupported or with reduced motion. Resolves once the new theme is applied.
 */
export function switchTheme(pref: ThemePref, origin?: { x: number; y: number }, win: Window = window): Promise<void> {
  const doc = win.document as Document & {
    startViewTransition?: (update: () => void) => { updateCallbackDone: Promise<void>; ready: Promise<void>; finished: Promise<void> };
  };
  if (!doc.startViewTransition || prefersReducedMotion(win)) { applyTheme(pref, win); return Promise.resolve(); }
  const root = doc.documentElement;
  if (origin) root.classList.add('theme-sweep');
  const transition = doc.startViewTransition(() => { applyTheme(pref, win); });
  const applied = transition.updateCallbackDone.catch(() => { /* the update itself threw; nothing to wait for */ });
  if (!origin) return applied;
  const { x, y } = origin;
  const radius = Math.ceil(Math.hypot(Math.max(x, win.innerWidth - x), Math.max(y, win.innerHeight - y)));
  transition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.2, .8, .2, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => { /* transition skipped: the theme is already applied */ });
  const done = () => root.classList.remove('theme-sweep');
  transition.finished.then(done, done);
  return applied;
}

/**
 * Which theme a signed-in account should use. A theme saved on the account wins; an account that has never saved
 * one (a fresh sign-up) adopts this device's explicit choice, so the theme picked on the sign-up page carries over.
 */
export function accountTheme(rawPreferences: unknown, local: ThemePref): { pref: ThemePref; adopt: boolean } {
  const saved = typeof rawPreferences === 'object' && rawPreferences !== null ? (rawPreferences as { theme?: unknown }).theme : undefined;
  if (isPref(saved)) return { pref: saved, adopt: false };
  return { pref: local, adopt: local !== 'system' };
}

const currentTheme = (): Theme => {
  const t = document.documentElement.dataset.theme;
  return isTheme(t) ? t : 'daybreak';
};

/** The theme on screen right now, live. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => 'night');
}
