const KEY = 'ss.splash';

/** The logo intro plays once per browser session, and never for people who prefer reduced motion. */
export function shouldPlaySplash(storage: Pick<Storage, 'getItem'> | null, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  try {
    return storage?.getItem(KEY) !== 'played';
  } catch {
    return false; // storage blocked: we can't remember it played, so don't risk replaying it on every load
  }
}

export function markSplashPlayed(storage: Pick<Storage, 'setItem'> | null) {
  try { storage?.setItem(KEY, 'played'); } catch { /* storage unavailable */ }
}

export const SPLASH_VIDEO = { dark: '/brand/logo-intro-dark.mp4', light: '/brand/logo-intro-light.mp4' } as const;
/** Each video's edge colour, so letterboxing on tall or narrow screens is invisible. */
export const SPLASH_BG = { dark: '#0A1025', light: '#FAF9FE' } as const;
