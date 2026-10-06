import { cn } from '@/lib/cn';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <g className="logo-orbit" style={{ transformOrigin: '32px 32px' }}>
        <ellipse cx="32" cy="32" rx="27" ry="12" fill="none" stroke="var(--primary)" strokeWidth="3" transform="rotate(-24 32 32)" opacity=".85" />
      </g>
      <path d="M32 10c1.7 11 4.9 14.3 16 16-11.1 1.7-14.3 5-16 16-1.7-11-4.9-14.3-16-16 11.1-1.7 14.3-5 16-16z" fill="var(--gold)" />
    </svg>
  );
}

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size === 'sm' ? 24 : 30} />
      <span className={cn('font-display tracking-tight', size === 'sm' ? 'text-lg' : 'text-xl')}>StudySpace</span>
    </span>
  );
}
