import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAchievements } from '@/features/gamification/api';
import { GoalsList } from '@/features/goals/GoalsList';
import { ActivityFeed } from './ActivityFeed';
import { OurSky } from './OurSkyView';
import { PartnerCard } from './PartnerCard';
import { CheerButton, ShootingStarButton } from './ShootingStarDialog';
import { StudyTogetherButton } from './StudyTogether';
import { StatBlocks } from './StatBlocks';

export default function SpacePage() {
  const { partner } = useAuth();
  const { all } = useAchievements(undefined);
  if (!partner) {
    return (
      <div>
        <PageHeader title="Our Space" />
        <EmptyState title="Our Space is made for two" body="Invite your partner to share a sky, study together and send shooting stars."
          action={<Link to="/settings/partner" className="text-primary underline">Invite your partner</Link>} />
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Our Space" subtitle="Two skies, one constellation." />
      <div className="stagger flex flex-col gap-4 lg:grid lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-12"><OurSky /></div>
        <div className="min-w-0 lg:col-span-12"><StatBlocks achievementsLabel={(n) => `${n} / ${all.length}`} /></div>
        <div className="min-w-0 lg:col-span-5"><PartnerCard actions={<><StudyTogetherButton /><ShootingStarButton /></>} /></div>
        <div className="min-w-0 lg:col-span-7"><ActivityFeed cheer={(item) => <CheerButton item={item} />} /></div>
        <div className="min-w-0 lg:col-span-12"><Card><GoalsList title="Shared goals" filter={(g) => g.is_shared} canCreate /></Card></div>
      </div>
    </div>
  );
}
