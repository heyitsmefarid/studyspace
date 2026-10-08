import { useId } from 'react';
import { cn } from '@/lib/cn';
import { oppositeTheme, useTheme } from '@/lib/theme';
import { originOf, useChooseTheme } from '@/features/auth/useChooseTheme';

const RAYS = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

/** Sun (Daybreak) that morphs into a crescent moon (Night). One click flips the theme; Settings still offers System. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const choose = useChooseTheme();
  const maskId = `moon-bite-${useId().replace(/[^\w-]/g, '')}`;
  const night = theme === 'night';
  const label = night ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      onClick={(e) => choose(oppositeTheme(theme), originOf(e.currentTarget))}
      aria-label={label}
      title={label}
      data-night={night || undefined}
      className={cn('theme-toggle grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-200 hover:bg-surface-2',
        night ? 'text-primary' : 'text-gold', className)}
    >
      <svg viewBox="0 0 24 24" className="size-5 overflow-visible" aria-hidden>
        <mask id={maskId}>
          <rect x="-4" y="-4" width="32" height="32" fill="white" />
          <circle className="theme-toggle-bite" cx="18" cy="7" r="7" fill="black" />
        </mask>
        <circle className="theme-toggle-body" cx="12" cy="12" r="8.5" fill="currentColor" mask={`url(#${maskId})`} />
        <g className="theme-toggle-rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {RAYS.map((a) => (
            <line key={a} x1={12 + Math.cos(a) * 8} y1={12 + Math.sin(a) * 8} x2={12 + Math.cos(a) * 10.5} y2={12 + Math.sin(a) * 10.5} />
          ))}
        </g>
      </svg>
    </button>
  );
}
