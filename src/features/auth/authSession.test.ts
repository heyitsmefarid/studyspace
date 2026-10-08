import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { readAuthSession, signOutSession } from './authSession';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

const session: Session = {
  access_token: 'access', refresh_token: 'refresh', expires_in: 3600, token_type: 'bearer',
  user: { id: 'member', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
};

describe('auth session recovery', () => {
  beforeEach(() => vi.resetAllMocks());

  it('settles with a recoverable error when loading the session rejects', async () => {
    auth.getSession.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await readAuthSession();
    expect(result.session).toBeNull();
    expect(result.error).toMatch(/connection/i);
  });

  it('does not treat a returned auth error as a signed-out session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'Failed to fetch' } });
    expect((await readAuthSession()).error).toMatch(/connection/i);
  });

  it('can load a valid session after a failed attempt', async () => {
    auth.getSession.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ data: { session }, error: null });
    await readAuthSession();
    expect(await readAuthSession()).toEqual({ session, error: null });
  });

  it('recognizes a successfully checked signed-out session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await readAuthSession()).toEqual({ session: null, error: null });
  });

  it('rejects a failed sign-out so callers cannot report success or navigate', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'Failed to fetch' } });
    await expect(signOutSession()).rejects.toThrow(/connection/i);
  });

  it('resolves after a successful sign-out', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await expect(signOutSession()).resolves.toBeUndefined();
  });
});
