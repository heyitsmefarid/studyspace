import { useId } from 'react';
import { cn } from '@/lib/cn';

/** The S is the shared path of two stars — a gold one and a blue one: you and your study partner. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId();
  return (
    <svg viewBox="14 8 72 84" width={Math.round(size * 72 / 84)} height={size} aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--logo-from)" />
          <stop offset="1" stopColor="var(--logo-to)" />
        </linearGradient>
      </defs>
      <path d="M68 30C66 18 34 16 33 32C32 46 67 50 67 66C67 84 34 84 31 71" fill="none" stroke={`url(#${id}-s)`} strokeWidth="10" strokeLinecap="round" />
      <circle cx="30" cy="72" r="6.5" fill="var(--logo-blue)" />
      <g className="logo-orbit" style={{ transformOrigin: '69px 27px' }}>
        <path d="M69 15C70.9 25.1 70.9 25.1 81 27C70.9 28.9 70.9 28.9 69 39C67.1 28.9 67.1 28.9 57 27C67.1 25.1 67.1 25.1 69 15Z" fill="var(--logo-gold)" />
      </g>
    </svg>
  );
}

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size === 'sm' ? 24 : 30} />
      <span className={cn('font-display tracking-tight', size === 'sm' ? 'text-lg' : 'text-xl')}>
        study<span className="text-primary">space</span>
      </span>
    </span>
  );
}
