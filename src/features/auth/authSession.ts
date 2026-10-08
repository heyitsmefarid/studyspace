import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { assertOk, friendlyMessage } from '@/lib/errors';

export async function readAuthSession(): Promise<{ session: Session | null; error: string | null }> {
  try {
    const result = await supabase.auth.getSession();
    assertOk(result);
    return { session: result.data.session, error: null };
  } catch (error) {
    return { session: null, error: friendlyMessage(error) };
  }
}

export async function signOutSession(): Promise<void> {
  assertOk(await supabase.auth.signOut());
}
