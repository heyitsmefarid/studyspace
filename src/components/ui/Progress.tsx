import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const FILL = { primary: 'bg-primary', gold: 'bg-gold', teal: 'bg-teal', coral: 'bg-coral' } as const;

export function ProgressBar({ value, tone = 'primary', label, className }: { value: number; tone?: keyof typeof FILL; label?: string; className?: string }) {
  const v = clamp(value);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className={cn('h-full origin-left animate-grow-x rounded-full transition-[width] duration-300', FILL[tone])} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 48, stroke = 4, label, children, color = 'var(--gold)' }: {
  value: number; size?: number; stroke?: number; label?: string; children?: ReactNode; color?: string;
}) {
  const v = clamp(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c * (1 - v)} className="ring-fill" style={{ ['--ring-c' as string]: c } as CSSProperties} />
      </svg>
      <span className="absolute text-xs font-semibold tabular">{children ?? `${Math.round(v * 100)}%`}</span>
    </div>
  );
}
