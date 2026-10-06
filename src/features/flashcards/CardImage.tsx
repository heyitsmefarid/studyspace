import { useSignedUrl } from '@/lib/storage';
import { Skeleton } from '@/components/ui/Skeleton';

export function CardImage({ path, alt = '' }: { path: string | null | undefined; alt?: string }) {
  const url = useSignedUrl('card-images', path);
  if (!path) return null;
  if (!url) return <Skeleton className="mx-auto h-40 w-56" />;
  return <img src={url} alt={alt} className="mx-auto max-h-56 rounded-xl object-contain" />;
}
