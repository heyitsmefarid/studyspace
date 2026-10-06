import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { supabase } from '@/lib/supabase';
import { friendlyMessage } from '@/lib/errors';
import { prefersReducedMotion } from '@/lib/motion';
import { replayAnimation } from '@/lib/replayAnimation';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useAuth } from './AuthProvider';
import { AuthLayout, StarBurst } from './AuthLayout';
import { PasswordInput } from './PasswordInput';

export default function LoginPage() {
  const { session, profile, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [burst, setBurst] = useState(false);

  if (!loading && session && profile && !burst) return <Navigate to={params.get('next') ?? '/'} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await signIn(email, password);
      setBurst(true);
      await new Promise((r) => setTimeout(r, prefersReducedMotion() ? 0 : 450));
      navigate(params.get('next') ?? '/', { replace: true });
    } catch (err) {
      setError(friendlyMessage(err));
      replayAnimation(formRef.current, 'animate-shake');
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${location.origin}/set-password` });
    setBusy(false);
    if (err) setError(friendlyMessage(err));
    else setResetMsg('If email delivery is set up for StudySpace, a reset link is on its way. If not, a password can be reset from the Supabase dashboard.');
  }

  return (
    <AuthLayout>
      <h1 className="mt-6 font-display text-2xl">{resetMode ? 'Reset your password' : 'Welcome back to your sky'}</h1>
      {params.get('error') === 'no-profile' && (
        <p role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral">This account isn't part of StudySpace.</p>
      )}
      <form ref={formRef} onSubmit={resetMode ? onReset : onSubmit} className="mt-5 flex flex-col gap-4">
        <Field label="Email">
          {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        {!resetMode && (
          <Field label="Password">
            {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="current-password" />}
          </Field>
        )}
        {error && <p role="alert" className="text-sm text-coral">{error}</p>}
        {resetMsg && <p role="status" className="text-sm text-teal">{resetMsg}</p>}
        <Button type="submit" loading={busy} size="lg" className="justify-center">{resetMode ? 'Send reset link' : 'Log in'}</Button>
      </form>
      {burst && <StarBurst />}
      <button onClick={() => { setResetMode((m) => !m); setError(null); setResetMsg(null); }} className="mt-4 text-sm text-primary underline-offset-2 hover:underline">
        {resetMode ? 'Back to log in' : 'Forgot password?'}
      </button>
      {!resetMode && <p className="mt-3 text-sm text-ink-muted">New here? <Link to="/signup" className="text-primary underline-offset-2 hover:underline">Create an account</Link></p>}
    </AuthLayout>
  );
}
