export type ThemePref = 'system' | 'night' | 'daybreak';
export type Theme = 'night' | 'daybreak';

const KEY = 'ss.theme';

export function resolveTheme(pref: ThemePref, prefersDark: boolean): Theme {
  if (pref === 'system') return prefersDark ? 'night' : 'daybreak';
  return pref;
}

export function readThemePref(): ThemePref {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '"system"');
    return v === 'night' || v === 'daybreak' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePref): Theme {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = resolveTheme(pref, prefersDark);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#0B1026' : '#F6F3FB');
  try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch { /* storage unavailable */ }
  return theme;
}
