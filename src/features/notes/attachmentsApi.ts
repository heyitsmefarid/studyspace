import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { AppError, assertOk, unwrap } from '@/lib/errors';
import { objectPath, removeFile, safeFileName, uploadFile } from '@/lib/storage';
import { useAuth } from '@/features/auth/AuthProvider';

export type Attachment = Tables<'note_attachments'>;
const MAX = 10 * 1024 * 1024;

export async function uploadNoteFile(noteId: string, uid: string, file: File, kind: 'file' | 'image'): Promise<Attachment> {
  if (file.size > MAX) throw new AppError('Files must be 10 MB or smaller.');
  if (kind === 'image' && !file.type.startsWith('image/')) throw new AppError('That is not an image.');
  const path = objectPath(uid, noteId, `${crypto.randomUUID()}-${safeFileName(file.name)}`);
  await uploadFile('note-files', path, file);
  return unwrap(await supabase.from('note_attachments').insert({
    note_id: noteId, owner_id: uid, kind, storage_path: path, file_name: file.name.slice(0, 255),
    mime_type: file.type || 'application/octet-stream', size_bytes: file.size,
  }).select().single());
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
