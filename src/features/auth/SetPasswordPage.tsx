import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input } from '@/components/ui/Field';
import { Logo } from '@/components/sky/Logo';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';
import { useAuth } from './AuthProvider';
import { StarBackdrop } from './LoginPage';

export default function SetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <div className="grid min-h-dvh place-items-center"><ConstellationLoader label="Checking your link…" /></div>;
  if (!session) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <EmptyState title="This link has expired" body="Ask for a new reset link, or log in if you remember your password."
          action={<Link to="/login" className="text-primary underline">Go to log in</Link>} />
      </main>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("Those passwords don't match.");
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyMessage(err));
    toast.success('Password updated ✦');
    navigate('/', { replace: true });
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <StarBackdrop />
      <Card className="relative z-10 w-full max-w-sm">
        <Logo />
        <h1 className="mt-6 font-display text-2xl">Choose a new password</h1>
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          <Field label="New password" hint="At least 8 characters">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label="Confirm password">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
          {error && <p role="alert" className="text-sm text-coral">{error}</p>}
          <Button type="submit" loading={busy} size="lg" className="justify-center">Save password</Button>
        </form>
      </Card>
    </main>
  );
}
