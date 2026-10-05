import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-glow',
        interactive && 'transition hover:-translate-y-0.5 hover:border-line-strong',
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-center justify-between gap-3', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('font-display text-lg text-ink', className)} {...rest} />;
}
