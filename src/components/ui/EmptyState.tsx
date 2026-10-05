import type { ReactNode } from 'react';

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center">
      <svg viewBox="0 0 120 60" className="mb-4 h-16 w-32 text-ink-faint" aria-hidden>
        <path d="M10 45 L40 20 L70 32 L105 12" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity=".6" />
        {[[10, 45], [40, 20], [70, 32]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2" fill="currentColor" opacity=".5" />)}
        <circle cx="105" cy="12" r="3.5" fill="var(--gold)" className="animate-twinkle" style={{ transformOrigin: '105px 12px' }} />
      </svg>
      <h3 className="font-display text-lg">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
