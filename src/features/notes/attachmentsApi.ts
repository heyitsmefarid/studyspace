import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { AppError, assertOk, unwrap } from '@/lib/errors';
import { objectPath, removeFile, safeContentType, safeFileName, uploadFile } from '@/lib/storage';
import { useAuth } from '@/features/auth/AuthProvider';
import { assertScannable, bytesToBase64 } from './attachmentScan';

export type Attachment = Tables<'note_attachments'>;
const MAX = 10 * 1024 * 1024;

export async function uploadNoteFile(noteId: string, uid: string, file: File, kind: 'file' | 'image'): Promise<Attachment> {
  if (file.size > MAX) throw new AppError('Files must be 10 MB or smaller.');
  if (kind === 'image' && !file.type.startsWith('image/')) throw new AppError('That is not an image.');
  const path = objectPath(uid, noteId, `${crypto.randomUUID()}-${safeFileName(file.name)}`);
  await uploadFile('note-files', path, file);
  return unwrap(await supabase.from('note_attachments').insert({
    note_id: noteId, owner_id: uid, kind, storage_path: path, file_name: file.name.slice(0, 255),
    mime_type: safeContentType(file.type), size_bytes: file.size,
  }).select().single());
}

/** A 5-minute signed link; files that can't render safely in the browser download under their own name. */
export async function attachmentUrl(a: Attachment, inline: boolean): Promise<string> {
  const { data, error } = await supabase.storage.from('note-files')
    .createSignedUrl(a.storage_path, 300, inline ? undefined : { download: a.file_name });
  if (error) throw error;
  return data.signedUrl;
}

export async function scanNoteAttachment(a: Attachment): Promise<string> {
  assertScannable(a.size_bytes, a.mime_type);
  const url = await attachmentUrl(a, false);
  const response = await fetch(url);
  if (!response.ok) throw new AppError('Nova could not read that attachment.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assertScannable(bytes.byteLength, a.mime_type);
  const { scanAttachment } = await import('@/services/ai/aiService');
  const result = await scanAttachment({ data: bytesToBase64(bytes), mimeType: a.mime_type, title: a.file_name });
  if (!result.ok) throw new AppError(result.error.message);
  return result.data.text;
}

export function useAttachments(noteId: string) {
  return useQuery({
    queryKey: ['attachments', noteId],
    queryFn: async () => unwrap(await supabase.from('note_attachments').select('*').eq('note_id', noteId).eq('kind', 'file').order('created_at')),
  });
}

export function useUploadAttachment(noteId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (file: File) => uploadNoteFile(noteId, user!.id, file, 'file'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', noteId] }),
  });
}

export function useDeleteAttachment(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Attachment) => {
      await removeFile('note-files', a.storage_path);
      assertOk(await supabase.from('note_attachments').delete().eq('id', a.id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', noteId] }),
  });
}

export function useScanAttachment() {
  return useMutation({ mutationFn: scanNoteAttachment });
}
