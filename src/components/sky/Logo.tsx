import { useId } from 'react';
import { cn } from '@/lib/cn';

/** The StudySpace mark: an S drawn as a path from a blue dot (you) to a gold star. Colours follow the theme. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const gradient = `logo-s-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg viewBox="14 8 72 84" width={size * (72 / 84)} height={size} aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--logo-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-to)' }} />
        </linearGradient>
      </defs>
      <path d="M68 30 C66 18 34 16 33 32 C32 46 67 50 67 66 C67 84 34 84 31 71" fill="none" stroke={`url(#${gradient})`} strokeWidth="10" strokeLinecap="round" />
      <circle cx="30" cy="72" r="6.5" fill="var(--logo-dot)" />
      <path transform="translate(69 27)" d="M0 -12 C1.92 -1.92 1.92 -1.92 12 0 C1.92 1.92 1.92 1.92 0 12 C-1.92 1.92 -1.92 1.92 -12 0 C-1.92 -1.92 -1.92 -1.92 0 -12Z" fill="var(--logo-star)" />
    </svg>
  );
}

/** Mark + wordmark lockup: "study" in ink, "space" in the brand violet. */
export function Logo({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size === 'sm' ? 24 : 30} />
      <span className={cn('font-display leading-none tracking-tight', size === 'sm' ? 'text-lg' : 'text-xl')}>
        study<span className="text-[var(--logo-word)]">space</span>
      </span>
    </span>
  );
}
