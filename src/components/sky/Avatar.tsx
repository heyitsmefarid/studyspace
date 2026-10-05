import { useSignedUrl } from '@/lib/storage';
import type { Profile } from '@/features/auth/AuthProvider';

export function Avatar({ profile, size = 40 }: { profile: Pick<Profile, 'display_name' | 'avatar_path' | 'star_color'> | null; size?: number }) {
  const url = useSignedUrl('avatars', profile?.avatar_path);
  const initial = (profile?.display_name?.trim()[0] ?? '✦').toUpperCase();
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-display text-ink"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${profile?.star_color ?? 'var(--star-me)'}`, fontSize: size * 0.42 }}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <span aria-hidden>{initial}</span>}
    </span>
  );
}
