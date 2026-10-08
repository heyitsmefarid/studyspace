import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { AppError, friendlyMessage, unwrap } from '@/lib/errors';
import { mergePreferences, readPreferences, type Preferences } from '@/lib/preferences';
import { accountTheme, applyTheme, readThemePref } from '@/lib/theme';

export type Profile = Tables<'profiles'>;

interface AuthValue {
  session: Session | null; user: Session['user'] | null; profile: Profile | null; partner: Profile | null;
  preferences: Preferences; loading: boolean;
  signIn(email: string, password: string): Promise<void>; signOut(): Promise<void>; refreshProfile(): Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setSessionLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/set-password') window.location.assign('/set-password');
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const uid = session?.user.id;
  const profiles = useQuery({
    queryKey: ['profiles'],
    enabled: Boolean(uid),
    queryFn: async () => unwrap(await supabase.from('profiles').select('*')),
  });
  const profile = profiles.data?.find((p) => p.id === uid) ?? null;
  const partner = profiles.data?.find((p) => p.id !== uid) ?? null;
  const preferences = useMemo(() => readPreferences(profile?.preferences), [profile?.preferences]);

  useEffect(() => {
    if (!profile) return;
    const { pref, adopt } = accountTheme(profile.preferences, readThemePref());
    applyTheme(pref);
    // A fresh account keeps the theme picked before signing up. Best-effort: this device remembers it either way.
    if (adopt) {
      void supabase.from('profiles').update({ preferences: mergePreferences(preferences, { theme: pref }) }).eq('id', profile.id)
        .then(() => qc.invalidateQueries({ queryKey: ['profiles'] }));
    }
  }, [profile, preferences, qc]);
  useEffect(() => {
    const root = document.documentElement.style;
    if (profile) root.setProperty('--star-me', profile.star_color);
    if (partner) root.setProperty('--star-partner', partner.star_color);
  }, [profile, partner]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new AppError(friendlyMessage(error));
  }, []);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);
  const refreshProfile = useCallback(async () => { await qc.invalidateQueries({ queryKey: ['profiles'] }); }, [qc]);

  const value: AuthValue = {
    session, user: session?.user ?? null, profile, partner, preferences,
    loading: sessionLoading || (Boolean(uid) && profiles.isPending),
    signIn, signOut, refreshProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
