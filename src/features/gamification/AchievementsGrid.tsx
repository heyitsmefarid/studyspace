import { format } from 'date-fns';
import { Award, Heart, Moon, MoonStar, Orbit, Sparkle, Sparkles, Sun, Telescope, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAchievements } from './api';

const ICONS: Record<string, LucideIcon> = {
  sparkle: Sparkle, zap: Zap, stars: Sparkles, orbit: Orbit, moon: Moon, sun: Sun, telescope: Telescope, trophy: Trophy, 'moon-star': MoonStar, heart: Heart,
};

export function AchievementsGrid({ userId }: { userId: string }) {
  const { all, unlocked, isPending } = useAchievements(userId);
  if (isPending) return <Skeleton className="h-40" />;
  return (
    <section aria-label="Achievements">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg">Achievements</h2>
        <p className="text-sm text-ink-muted tabular">{unlocked.size} / {all.length} unlocked</p>
      </div>
      <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {all.map((a) => {
          const at = unlocked.get(a.code);
          const Icon = ICONS[a.icon] ?? Award;
          return (
            <li key={a.code} className={cn('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center', at ? 'border-gold/40 bg-gold-soft' : 'border-dashed border-line-strong')}>
              <span className={cn('grid size-11 place-items-center rounded-full', at ? 'bg-gold text-primary-ink shadow-[0_0_16px_var(--gold)]' : 'bg-surface-2 text-ink-faint')}>
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="text-xs text-ink-muted">{at ? `Unlocked ${format(new Date(at), 'MMM d, yyyy')}` : a.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
