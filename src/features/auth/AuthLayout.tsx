import type { ReactNode } from 'react';
import { Logo } from '@/components/sky/Logo';
import { Card } from '@/components/ui/Card';

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

/**
 * Two stars ("you" and "your person"), a constellation line that draws in between them, drifting dust and a rare
 * shooting star. Desktop: the left half; phone: a band above the form.
 */
function AuthSky({ compact }: { compact?: boolean }) {
  return (
    <div aria-hidden className="relative h-full w-full overflow-hidden">
      <div className="study-starfield absolute inset-0" />
      <svg viewBox="0 0 400 300" preserveAspectRatio={compact ? 'xMidYMid slice' : 'xMidYMid meet'}
        className={compact ? 'absolute inset-0 size-full' : 'absolute left-1/2 top-[12%] w-[min(85%,520px)] -translate-x-1/2'}>
        <path d="M120 190 Q 200 120 285 150" fill="none" stroke="var(--line-strong)" strokeWidth="1.2" pathLength={1}
          strokeDasharray="1" className="animate-draw-line" style={{ animationDelay: '400ms' }} />
        <g className="animate-pop-in" style={{ animationDelay: '150ms', transformOrigin: '120px 190px' }}>
          <circle cx="120" cy="190" r="16" fill="var(--star-me)" opacity=".18" />
          <circle cx="120" cy="190" r="5" fill="var(--star-me)" style={{ filter: 'drop-shadow(0 0 8px var(--star-me))' }} />
        </g>
        <g className="animate-pop-in" style={{ animationDelay: '900ms', transformOrigin: '285px 150px' }}>
          <circle cx="285" cy="150" r="16" fill="var(--star-partner)" opacity=".18" />
          <circle cx="285" cy="150" r="5" fill="var(--star-partner)" style={{ filter: 'drop-shadow(0 0 8px var(--star-partner))' }} />
        </g>
        {!compact && (<>
          <text x="120" y="222" textAnchor="middle" fontSize="11" fill="var(--ink-muted)">you</text>
          <text x="285" y="182" textAnchor="middle" fontSize="11" fill="var(--ink-muted)">your person</text>
        </>)}
        <line x1="0" y1="0" x2="60" y2="22" stroke="var(--sky-star)" strokeWidth="1.2" strokeLinecap="round" className="shooting-star" />
      </svg>
      {!compact && (
        <div className="absolute inset-x-10 bottom-12">
          <p className="font-display text-3xl leading-tight">A study sky for two.</p>
          <p className="mt-2 max-w-sm text-ink-muted">Every session adds a star. Notes, cards, quizzes and Nova, shared with your person.</p>
        </div>
      )}
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      <StarBackdrop />
      <div className="relative hidden border-r border-line bg-surface/40 lg:block"><AuthSky /></div>
      <div className="relative h-44 lg:hidden"><AuthSky compact /></div>
      <div className="relative z-10 -mt-10 grid place-items-center px-4 pb-10 lg:mt-0 lg:py-10">
        <Card className="w-full max-w-sm animate-rise-in">
          <Logo className="logo-orbit-slow" />
          {children}
        </Card>
      </div>
    </main>
  );
}
