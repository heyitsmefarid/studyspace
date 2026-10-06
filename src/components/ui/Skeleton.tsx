import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-xl bg-surface-2', className)} aria-hidden />;
}
