import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { AppError, assertOk, friendlyMessage } from './errors';

export type Bucket = 'avatars' | 'note-files' | 'card-images' | 'chat-files' | 'market-images';

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).filter((p) => p && p !== '..' && p !== '.').join('-').toLowerCase();
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const ext = dot > 0 ? base.slice(dot + 1).replace(/[^a-z0-9]/g, '') : '';
  return ((stem || 'file') + (ext ? `.${ext}` : '')).slice(0, 120);
}

export const objectPath = (uid: string, ...segments: string[]) => [uid, ...segments].join('/');

export async function uploadFile(bucket: Bucket, path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new AppError(/exceed|too large/i.test(error.message) ? 'That file is too large.' : friendlyMessage(error), undefined, error);
}

export async function removeFile(bucket: Bucket, path: string): Promise<void> {
  assertOk(await supabase.storage.from(bucket).remove([path]));
}

export function useSignedUrl(bucket: Bucket, path: string | null | undefined): string | undefined {
  const { data } = useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: Boolean(path),
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 3600);
      if (error) throw new AppError(friendlyMessage(error));
      return data.signedUrl;
    },
  });
  return data;
}
