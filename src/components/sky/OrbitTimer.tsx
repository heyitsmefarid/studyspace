import type { ReactNode } from 'react';
import { formatClock } from '@/lib/dates';
import type { Phase } from '@/features/study/timer';

const LABEL: Record<Phase, string> = { focus: 'Focus', short_break: 'Short break', long_break: 'Long break' };

export function OrbitTimer({ progress, phase, remaining, elapsed, completed, size = 300, companion }: {
  progress: number; phase: Phase; remaining: number | null; elapsed: number; completed: number; size?: number; companion?: ReactNode;
}) {
  const r = 120, c = 2 * Math.PI * r;
  const angle = progress * 360 - 90;
  const isBreak = phase !== 'focus';
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 300 300" className="absolute inset-0" aria-hidden>
        <circle cx="150" cy="150" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="2 6" />
        <circle cx="150" cy="150" r={r} fill="none" stroke={isBreak ? 'var(--teal)' : 'var(--primary)'} strokeWidth="3"
          strokeDasharray={`${c * progress} ${c}`} transform="rotate(-90 150 150)" strokeLinecap="round" />
        {progress > 0.01 && (() => {
          // A short fading trail along the orbit behind the planet.
          const end = progress * 2 * Math.PI - Math.PI / 2;
          const start = Math.max(-Math.PI / 2, end - 0.06 * 2 * Math.PI);
          const p = (a: number) => `${150 + Math.cos(a) * r} ${150 + Math.sin(a) * r}`;
          return <path d={`M ${p(start)} A ${r} ${r} 0 0 1 ${p(end)}`} fill="none" stroke={isBreak ? 'var(--teal)' : 'var(--gold)'} strokeWidth="6" strokeLinecap="round" opacity=".25" />;
        })()}
        <g transform={`rotate(${angle + 90} 150 150)`}>
          <circle cx="150" cy={150 - r} r="9" fill={isBreak ? 'var(--teal)' : 'var(--gold)'} style={{ filter: 'drop-shadow(0 0 10px var(--gold))' }} />
        </g>
        {Array.from({ length: Math.min(completed, 8) }, (_, i) => {
          const a = (i / 8) * 2 * Math.PI - Math.PI / 2;
          return <circle key={i} cx={150 + Math.cos(a) * 70} cy={150 + Math.sin(a) * 70} r="4" fill="var(--ink-muted)" />;
        })}
      </svg>
      <div className="relative text-center" aria-live="polite">
        <div key={phase} className="animate-pop-in text-sm uppercase tracking-[0.2em] text-ink-muted">{LABEL[phase]}</div>
        <div className="tabular font-display text-6xl">{formatClock(remaining ?? elapsed)}</div>
        <div className="text-xs text-ink-faint">{completed} {completed === 1 ? 'moon' : 'moons'}</div>
      </div>
      {companion && (
        <div aria-hidden className="absolute inset-0 transition-transform duration-1000 ease-linear" style={{ transform: `rotate(${progress * 360 + 180}deg)` }}>
          <div className="absolute left-1/2 top-[10%] -translate-x-1/2 -translate-y-1/2" style={{ transform: `rotate(${-(progress * 360 + 180)}deg)` }}>{companion}</div>
        </div>
      )}
    </div>
  );
}
