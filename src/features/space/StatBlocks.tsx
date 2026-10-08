import { useState } from 'react';
import { formatDuration } from '@/lib/dates';
import { useCountUp } from '@/lib/countUp';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Comet } from '@/components/sky/Comet';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSpaceStats } from './api';
import { spaceBlocks, type MemberBlock } from './stats';

function MemberCard({ title, block, achievementsLabel }: { title: string; block: MemberBlock | null; achievementsLabel: (n: number) => string }) {
  const week = useCountUp(block?.weekSeconds ?? 0, 900);
  const total = useCountUp(block?.totalSeconds ?? 0, 900);
  if (!block) return <Card><p className="text-sm text-ink-muted">{title}</p><p className="mt-2 text-sm">Not here yet.</p></Card>;
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{title}</p>
      <Comet streak={block.streak} size="sm" />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-muted">This week</dt><dd className="tabular">{formatDuration(week)}</dd>
        <dt className="text-ink-muted">All time</dt><dd className="tabular">{formatDuration(total)}</dd>
        <dt className="text-ink-muted">Cards this week</dt><dd className="tabular">{block.cardsWeek}</dd>
        <dt className="text-ink-muted">Achievements</dt><dd className="tabular">{achievementsLabel(block.achievements)}</dd>
      </dl>
    </Card>
  );
}

export function StatBlocks({ achievementsLabel = (n: number) => String(n) }: { achievementsLabel?: (n: number) => string }) {
  const { profile, partner } = useAuth();
  const stats = useSpaceStats();
  const [now] = useState(() => new Date());
  const b = profile
    ? spaceBlocks(stats.data ?? [], { id: profile.id, tz: profile.timezone }, partner ? { id: partner.id, tz: partner.timezone } : null, now)
    : null;
  const together = useCountUp(b?.togetherSeconds ?? 0, 900);
  if (stats.isPending || !b) return <Skeleton className="h-44" />;
  return (
    <div className="stagger grid gap-3 sm:grid-cols-3">
      <MemberCard title="You" block={b.me} achievementsLabel={achievementsLabel} />
      <MemberCard title={partner?.display_name || 'Your partner'} block={b.partner} achievementsLabel={achievementsLabel} />
      <Card className="flex flex-col justify-center gap-1 border-gold/30 bg-gold-soft/40">
        <p className="text-sm font-semibold">Together</p>
        <p className="font-display text-3xl tabular text-gold">{formatDuration(together)}</p>
        <p className="text-xs text-ink-muted">of focus side by side ✦</p>
      </Card>
    </div>
  );
}
