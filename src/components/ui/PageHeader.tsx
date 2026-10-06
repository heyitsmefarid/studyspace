import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
        <span aria-hidden className="mt-2 flex items-center gap-1.5">
          <span className="block h-0.5 w-16 origin-left animate-grow-x rounded-full bg-[linear-gradient(90deg,var(--primary),var(--gold))]" />
          <svg viewBox="0 0 24 24" className="size-2.5 animate-twinkle text-gold"><path d="M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z" fill="currentColor" /></svg>
        </span>
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
