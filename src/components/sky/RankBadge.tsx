import { levelProgress } from '@/features/gamification/levels';
import { ProgressBar } from '@/components/ui/Progress';

export function RankBadge({ xp, compact }: { xp: number; compact?: boolean }) {
  const p = levelProgress(xp);
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gold">
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
          <path d="M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z" fill="currentColor" />
        </svg>
        <span className="truncate">{p.rank} · Lv {p.level}</span>
      </div>
      {!compact && (
        <div className="mt-1.5">
          <ProgressBar value={p.pct} tone="gold" label={`Level progress: ${p.into} of ${p.needed} XP`} />
          <p className="mt-1 text-xs text-ink-muted tabular">{p.into}/{p.needed} XP to level {p.level + 1}</p>
        </div>
      )}
    </div>
  );
}
