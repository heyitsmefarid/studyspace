import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export function PasswordSection() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("Those passwords don't match.");
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyMessage(err));
    setPassword(''); setConfirm('');
    toast.success('Password updated ✦');
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4">
      <Field label="New password" hint="At least 8 characters">
        {(id) => <Input id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field label="Confirm password">
        {(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
      </Field>
      {error && <p role="alert" className="text-sm text-coral">{error}</p>}
      <Button type="submit" loading={busy} done={saved} className="self-start">Update password</Button>
    </form>
  );
}
