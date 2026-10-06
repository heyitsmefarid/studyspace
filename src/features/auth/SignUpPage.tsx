import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import { friendlyMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useAuth } from './AuthProvider';
import { AuthLayout, StarBurst } from './AuthLayout';
import { PasswordInput } from './PasswordInput';
import { validateSignUp, type SignUpInput } from './signUpForm';

export default function SignUpPage() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<SignUpInput>({ email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof SignUpInput, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [burst, setBurst] = useState(false);

  if (!loading && session && profile && !burst) return <Navigate to="/" replace />;
  const set = (k: keyof SignUpInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validateSignUp(form);
    if (!v.ok) { setErrors(v.errors); setShakeKey((k) => k + 1); return; }
    setErrors({}); setError(null); setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: v.value.email,
      password: v.value.password,
      options: { emailRedirectTo: `${location.origin}/login` },
    });
    setBusy(false);
    if (err) { setError(friendlyMessage(err)); setShakeKey((k) => k + 1); return; }
    if (data.session) {
      setBurst(true);
      await refreshProfile();
      await new Promise((r) => setTimeout(r, prefersReducedMotion() ? 0 : 450));
      navigate('/onboarding', { replace: true });
    } else {
      setCheckEmail(true);
    }
  }

  return (
    <AuthLayout>
      {checkEmail ? (
        <div className="animate-rise-in">
          <h1 className="mt-6 font-display text-2xl">Check your email</h1>
          <p className="mt-2 text-sm text-ink-muted">
            We sent a confirmation link to <strong className="text-ink">{form.email.trim().toLowerCase()}</strong>. Open it, then log in.
          </p>
          <Link to="/login" className="mt-5 inline-block text-sm text-primary underline-offset-2 hover:underline">Go to log in</Link>
        </div>
      ) : (
        <>
          <h1 className="mt-6 font-display text-2xl">Create your star</h1>
          <p className="mt-1 text-sm text-ink-muted">StudySpace is for two. The first account opens the sky; the second needs an invite from the first.</p>
          <form key={shakeKey} onSubmit={onSubmit} className={cn('mt-5 flex flex-col gap-4', shakeKey > 0 && 'animate-shake')} noValidate>
            <Field label="Email" error={errors.email}>
              {(id) => <Input id={id} type="email" autoComplete="email" invalid={Boolean(errors.email)} value={form.email} onChange={(e) => set('email')(e.target.value)} />}
            </Field>
            <Field label="Password" error={errors.password}>
              {(id) => <PasswordInput id={id} value={form.password} onChange={set('password')} autoComplete="new-password" invalid={Boolean(errors.password)} showStrength />}
            </Field>
            <Field label="Confirm password" error={errors.confirm}>
              {(id) => <PasswordInput id={id} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" invalid={Boolean(errors.confirm)} />}
            </Field>
            {error && <p role="alert" className="text-sm text-coral">{error}</p>}
            <Button type="submit" loading={busy} size="lg" className="justify-center">Create account</Button>
          </form>
          {burst && <StarBurst />}
          <p className="mt-4 text-sm text-ink-muted">Already have an account? <Link to="/login" className="text-primary underline-offset-2 hover:underline">Log in</Link></p>
        </>
      )}
    </AuthLayout>
  );
}
