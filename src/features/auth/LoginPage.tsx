import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Logo } from '@/components/sky/Logo';
import { useAuth } from './AuthProvider';

export function StarBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: [
            'radial-gradient(1px 1px at 12% 18%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 72% 12%, var(--sky-star), transparent)',
            'radial-gradient(1.5px 1.5px at 38% 62%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 88% 48%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 22% 82%, var(--sky-star), transparent)',
            'radial-gradient(1.5px 1.5px at 58% 30%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 92% 86%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 6% 52%, var(--sky-star), transparent)',
          ].join(','),
        }}
      />
      <svg className="absolute right-[12%] top-[14%] size-6 animate-twinkle" viewBox="0 0 24 24" style={{ transformOrigin: 'center' }}>
        <path d="M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z" fill="var(--gold)" />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const { session, profile, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  if (!loading && session && profile) return <Navigate to={params.get('next') ?? '/'} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await signIn(email, password);
      navigate(params.get('next') ?? '/', { replace: true });
    } catch (err) {
      setError(friendlyMessage(err));
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
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <StarBackdrop />
      <Card className="relative z-10 w-full max-w-sm">
        <Logo />
        <h1 className="mt-6 font-display text-2xl">{resetMode ? 'Reset your password' : 'Welcome back to your sky'}</h1>
        {params.get('error') === 'no-profile' && (
          <p role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral">This account isn't part of StudySpace.</p>
        )}
        <form onSubmit={resetMode ? onReset : onSubmit} className="mt-5 flex flex-col gap-4">
          <Field label="Email">
            {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          {!resetMode && (
            <Field label="Password">
              {(id) => (
                <div className="relative">
                  <Input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} className="pr-11" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1 grid size-9 place-items-center rounded-lg text-ink-faint hover:text-ink"
                    aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>
          )}
          {error && <p role="alert" className="text-sm text-coral">{error}</p>}
          {resetMsg && <p role="status" className="text-sm text-teal">{resetMsg}</p>}
          <Button type="submit" loading={busy} size="lg" className="justify-center">{resetMode ? 'Send reset link' : 'Log in'}</Button>
        </form>
        <button onClick={() => { setResetMode((m) => !m); setError(null); setResetMsg(null); }} className="mt-4 text-sm text-primary underline-offset-2 hover:underline">
          {resetMode ? 'Back to log in' : 'Forgot password?'}
        </button>
      </Card>
    </main>
  );
}
