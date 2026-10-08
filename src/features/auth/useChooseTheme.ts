import { useCallback } from 'react';
import { switchTheme, type ThemePref } from '@/lib/theme';
import { useAuth } from './AuthProvider';
import { useUpdatePreferences } from './useProfileMutations';

/**
 * Switch theme (animated, see switchTheme) and, when signed in, save it to the account. The save waits until the new
 * theme is on screen: saving re-applies the theme, which would otherwise land before the transition's old snapshot.
 */
export function useChooseTheme() {
  const { profile } = useAuth();
  const { mutate } = useUpdatePreferences();
  const signedIn = Boolean(profile);
  return useCallback((pref: ThemePref, origin?: { x: number; y: number }) => {
    void switchTheme(pref, origin).then(() => { if (signedIn) mutate({ theme: pref }); });
  }, [signedIn, mutate]);
}

/** The centre of the clicked element, for the theme sweep to grow out of. */
export function originOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
