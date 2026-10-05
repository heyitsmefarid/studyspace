import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  neutral: 'bg-surface-2 text-ink-muted',
  primary: 'bg-primary-soft text-primary',
  gold: 'bg-gold-soft text-gold',
  teal: 'bg-teal-soft text-teal',
  coral: 'bg-coral-soft text-coral',
} as const;

export function Badge({ tone = 'neutral', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)} {...rest} />;
}
