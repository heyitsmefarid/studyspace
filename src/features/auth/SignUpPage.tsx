import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Logo } from '@/components/sky/Logo';
import { useAuth } from './AuthProvider';
import { StarBackdrop } from './LoginPage';
import { validateSignUp, type SignUpInput } from './signUpForm';

export default function SignUpPage() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<SignUpInput>({ email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof SignUpInput, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  if (!loading && session && profile) return <Navigate to="/" replace />;
  const set = (k: keyof SignUpInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validateSignUp(form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({}); setError(null); setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: v.value.email,
      password: v.value.password,
      options: { emailRedirectTo: `${location.origin}/login` },
    });
    setBusy(false);
    if (err) return setError(friendlyMessage(err));
    if (data.session) {
      await refreshProfile();
      navigate('/onboarding', { replace: true });
    } else {
      setCheckEmail(true);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <StarBackdrop />
      <Card className="relative z-10 w-full max-w-sm">
        <Logo />
        {checkEmail ? (
          <>
            <h1 className="mt-6 font-display text-2xl">Check your email</h1>
            <p className="mt-2 text-sm text-ink-muted">
              We sent a confirmation link to <strong className="text-ink">{form.email.trim().toLowerCase()}</strong>. Open it, then log in.
            </p>
            <Link to="/login" className="mt-5 inline-block text-sm text-primary underline-offset-2 hover:underline">Go to log in</Link>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl">Create your star</h1>
            <p className="mt-1 text-sm text-ink-muted">StudySpace is for two. The first account opens the sky; the second needs an invite from the first.</p>
            <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4" noValidate>
              <Field label="Email" error={errors.email}>
                {(id) => <Input id={id} type="email" autoComplete="email" invalid={Boolean(errors.email)} value={form.email} onChange={set('email')} />}
              </Field>
              <Field label="Password" hint="At least 8 characters" error={errors.password}>
                {(id) => <Input id={id} type="password" autoComplete="new-password" invalid={Boolean(errors.password)} value={form.password} onChange={set('password')} />}
              </Field>
              <Field label="Confirm password" error={errors.confirm}>
                {(id) => <Input id={id} type="password" autoComplete="new-password" invalid={Boolean(errors.confirm)} value={form.confirm} onChange={set('confirm')} />}
              </Field>
              {error && <p role="alert" className="text-sm text-coral">{error}</p>}
              <Button type="submit" loading={busy} size="lg" className="justify-center">Create account</Button>
            </form>
            <p className="mt-4 text-sm text-ink-muted">Already have an account? <Link to="/login" className="text-primary underline-offset-2 hover:underline">Log in</Link></p>
          </>
        )}
      </Card>
    </main>
  );
}
