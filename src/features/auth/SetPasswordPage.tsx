import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';
import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';
import { passwordProgress } from './skyProgress';

export default function SetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stumble, setStumble] = useState(0);
  const fail = (message: string) => { setError(message); setStumble((n) => n + 1); };

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
    if (password.length < 8) return fail('Use at least 8 characters.');
    if (password !== confirm) return fail("Those passwords don't match.");
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return fail(friendlyMessage(err));
    toast.success('Password updated ✦');
    navigate('/', { replace: true });
  }

  return (
    // The account already exists, so its first link is lit.
    <AuthLayout progress={1 + passwordProgress(password, confirm)} stumble={stumble}>
        <h1 className="mt-6 font-display text-2xl">Choose a new password</h1>
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          <Field label="New password">
            {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="new-password" showStrength />}
          </Field>
          <Field label="Confirm password">
            {(id) => <PasswordInput id={id} value={confirm} onChange={setConfirm} autoComplete="new-password" />}
          </Field>
          {error && <p role="alert" className="text-sm text-coral">{error}</p>}
          <Button type="submit" loading={busy} size="lg" className="justify-center">Save password</Button>
        </form>
    </AuthLayout>
  );
}
