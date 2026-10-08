import type { ReactNode } from 'react';
import { Logo } from '@/components/sky/Logo';
import { ThemeToggle } from '@/components/sky/ThemeToggle';
import { Card } from '@/components/ui/Card';
import { LivingSky } from './LivingSky';

/** Sparse twinkling backdrop shared by the auth pages and onboarding (moved here from LoginPage.tsx). */
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

/** A ring of gold sparks shown for ~450 ms after a successful log-in or sign-up. */
export function StarBurst() {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 m-auto size-40">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <circle key={i} cx={50 + Math.cos(a) * 34} cy={50 + Math.sin(a) * 34} r="2.2" fill="var(--gold)"
          className="animate-pop-in" style={{ animationDelay: `${i * 30}ms`, transformOrigin: '50px 50px' }} />;
      })}
    </svg>
  );
}

export function AuthLayout({ children, progress = 0, celebrate = false, stumble = 0 }: {
  children: ReactNode;
  /** Lit constellation links, 0…SKY_LINKS (skyProgress.ts). */
  progress?: number;
  /** Success: a comet runs the constellation before the page moves on. */
  celebrate?: boolean;
  /** Failed attempts so far; each one makes the constellation flicker. */
  stumble?: number;
}) {
  const sky = { progress, celebrate, stumble };
  return (
    <main className="relative min-h-dvh lg:grid lg:grid-cols-[1.15fr_1fr]">
      <StarBackdrop />
      <ThemeToggle className="absolute right-3 top-3 z-20 border border-line bg-surface/70 backdrop-blur lg:right-6 lg:top-6" />
      <div className="relative hidden p-3 lg:block">
        <div className="sticky top-3 h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[1.75rem] border border-line shadow-glow">
          <LivingSky {...sky} />
        </div>
      </div>
      <div className="relative h-56 lg:hidden"><LivingSky {...sky} compact /></div>
      <div className="relative z-10 -mt-12 grid place-items-center px-4 pb-10 lg:mt-0 lg:py-10">
        <Card className="w-full max-w-sm animate-rise-in bg-surface/80 backdrop-blur-xl">
          <Logo className="logo-orbit-slow" />
          {children}
        </Card>
      </div>
    </main>
  );
}
