import { Link } from 'react-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { Avatar } from '@/components/sky/Avatar';
import { RankBadge } from '@/components/sky/RankBadge';

export function ProfileChip({ compact }: { compact?: boolean }) {
  const { profile } = useAuth();
  return (
    <Link to="/profile" className="flex min-w-0 items-center gap-3 rounded-xl p-1.5 hover:bg-surface-2" aria-label="Your profile">
      <Avatar profile={profile} size={compact ? 32 : 36} />
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{profile?.display_name || 'You'}</span>
          <RankBadge xp={profile?.xp ?? 0} compact />
        </span>
      )}
    </Link>
  );
}
