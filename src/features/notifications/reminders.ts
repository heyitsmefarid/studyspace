import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

const HOUR = 3_600_000;
export const reminderDue = (lastMs: number | null, nowMs: number) => lastMs === null || nowMs - lastMs >= HOUR;

let last: number | null = null;

async function refresh() {
  last = Date.now();
  const { error } = await supabase.rpc('refresh_reminders');
  // Silent by design: the next load or focus retries; new reminders arrive through Realtime.
  if (error) console.warn('Reminder refresh failed', error.message);
}

/** Asks the server for due reminders on app load, then at most hourly when the window regains focus. */
export function useReminderRefresh() {
  const ready = Boolean(useAuth().profile);
  useEffect(() => {
    if (!ready) return;
    void refresh();
    const onFocus = () => { if (reminderDue(last, Date.now())) void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [ready]);
}
