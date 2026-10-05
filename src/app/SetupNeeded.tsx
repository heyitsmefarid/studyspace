import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/sky/Logo';

export function SetupNeeded() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="max-w-md">
        <Logo />
        <h1 className="mt-4 font-display text-2xl">Almost there</h1>
        <p className="mt-2 text-sm text-ink-muted">
          StudySpace can't find its Supabase settings. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code> (see <code>.env.example</code>) and restart the dev server.
        </p>
      </Card>
    </main>
  );
}
