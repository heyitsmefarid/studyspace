import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { friendlyMessage } from '@/lib/errors';
import { useAuth } from './AuthProvider';

export function AuthRecovery({ message }: { message: string }) {
  const { session, retryAuth, signOut } = useAuth();
  const [busy, setBusy] = useState<'retry' | 'signout' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(action: 'retry' | 'signout') {
    setBusy(action); setActionError(null);
    try {
      if (action === 'retry') await retryAuth();
      else await signOut();
    } catch (error) {
      setActionError(friendlyMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-5">
      <p role="alert" className="text-sm text-coral">{actionError ?? message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void run('retry')} loading={busy === 'retry'} disabled={busy !== null}>Try again</Button>
        {session && <Button variant="ghost" onClick={() => void run('signout')} loading={busy === 'signout'} disabled={busy !== null}>Log out</Button>}
      </div>
    </div>
  );
}
