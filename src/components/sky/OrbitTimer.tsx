import { formatClock } from '@/lib/dates';
import type { Phase } from '@/features/study/timer';

const LABEL: Record<Phase, string> = { focus: 'Focus', short_break: 'Short break', long_break: 'Long break' };

export function OrbitTimer({ progress, phase, remaining, elapsed, completed, size = 300 }: {
  progress: number; phase: Phase; remaining: number | null; elapsed: number; completed: number; size?: number;
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
        <g transform={`rotate(${angle + 90} 150 150)`}>
          <circle cx="150" cy={150 - r} r="9" fill={isBreak ? 'var(--teal)' : 'var(--gold)'} style={{ filter: 'drop-shadow(0 0 10px var(--gold))' }} />
        </g>
        {Array.from({ length: Math.min(completed, 8) }, (_, i) => {
          const a = (i / 8) * 2 * Math.PI - Math.PI / 2;
          return <circle key={i} cx={150 + Math.cos(a) * 70} cy={150 + Math.sin(a) * 70} r="4" fill="var(--ink-muted)" />;
        })}
      </svg>
      <div className="relative text-center" aria-live="polite">
        <div className="text-sm uppercase tracking-[0.2em] text-ink-muted">{LABEL[phase]}</div>
        <div className="tabular font-display text-6xl">{formatClock(remaining ?? elapsed)}</div>
        <div className="text-xs text-ink-faint">{completed} {completed === 1 ? 'moon' : 'moons'}</div>
      </div>
    </div>
  );
}
