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

/** Mirrors the note-files/chat-files bucket allowlist (migration 20261006000010). */
const STORABLE = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/heic',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'application/zip', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4',
]);
const INLINE_SAFE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'application/pdf']);
const baseType = (mime: string) => mime.split(';')[0]!.trim().toLowerCase();

/** Content type to store: anything outside the allowlist (including HTML/SVG/XML/JS) becomes an opaque download. */
export function safeContentType(mime: string): string {
  const t = baseType(mime);
  return STORABLE.has(t) ? t : 'application/octet-stream';
}

/** Only images and PDFs are opened in a tab; every other attachment is downloaded. */
export const opensInline = (mime: string) => INLINE_SAFE.has(baseType(mime));

export async function uploadFile(bucket: Bucket, path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: safeContentType(file.type), upsert: false });
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
