import { Link } from 'react-router';

/** Bottom-of-sidebar profile link. Task 8 replaces the placeholder avatar with the signed-in profile. */
export function ProfileChip({ compact }: { compact?: boolean }) {
  return (
    <Link to="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2" aria-label="Your profile">
      <span className="grid size-9 place-items-center rounded-full bg-primary-soft font-display text-primary ring-2 ring-star-me" aria-hidden>✦</span>
      {!compact && <span className="text-sm font-medium">Profile</span>}
    </Link>
  );
}
