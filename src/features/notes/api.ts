import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/react';
import { supabase, type Tables, type TablesUpdate } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { excerpt } from '@/lib/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { applyLocalFilters, sortNotes, type NoteFilters, type NoteListItem } from './filters';

export type Note = Tables<'notes'>;
export const noteKeys = {
  all: ['notes'] as const,
  list: (f: NoteFilters) => ['notes', 'list', f] as const,
  search: (q: string) => ['notes', 'search', q] as const,
  detail: (id: string) => ['notes', 'detail', id] as const,
  byIds: (ids: string[]) => ['notes', 'by-ids', ids] as const,
};
const LIST_COLS = 'id, owner_id, title, subject_id, folder_id, is_pinned, is_favorite, is_shared, updated_at, content_text';
type ListRow = Pick<Note, 'id' | 'owner_id' | 'title' | 'subject_id' | 'folder_id' | 'is_pinned' | 'is_favorite' | 'is_shared' | 'updated_at' | 'content_text'>;
const toItem = ({ content_text, ...rest }: ListRow): NoteListItem => ({ ...rest, excerpt: excerpt(content_text) });

export function useNotes(filters: NoteFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: noteKeys.list(filters),
    enabled: Boolean(user),
    queryFn: async () => {
      let q = supabase.from('notes').select(LIST_COLS).order('updated_at', { ascending: false }).limit(500);
      q = filters.scope === 'mine' ? q.eq('owner_id', user!.id) : q.neq('owner_id', user!.id);
      return sortNotes(applyLocalFilters(unwrap(await q).map(toItem), filters, user!.id));
    },
  });
}

export function useNoteSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: noteKeys.search(term),
    enabled: term.length >= 2,
    queryFn: async () => unwrap(await supabase.rpc('search_notes', { q: term })).map(toItem),
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => unwrap(await supabase.from('notes').select('*').eq('id', id!).single()),
  });
}

export function useNotesByIds(ids: string[]) {
  return useQuery({
    queryKey: noteKeys.byIds(ids),
    enabled: ids.length > 0,
    queryFn: async () => unwrap(await supabase.from('notes').select('id, title, content_text, subject_id, owner_id').in('id', ids)),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  const { user, preferences } = useAuth();
  return useMutation({
    mutationFn: async (input: { title?: string; content?: JSONContent; content_text?: string; subject_id?: string | null; folder_id?: string | null } = {}) =>
      unwrap(await supabase.from('notes').insert({ owner_id: user!.id, is_shared: preferences.privacy.shareByDefault, ...input }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

export function useUpdateNote({ silent = false }: { silent?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent },
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'notes'> }) =>
      unwrap(await supabase.from('notes').update(patch).eq('id', id).select().single()),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: noteKeys.detail(id) });
      const prev = qc.getQueryData<Note>(noteKeys.detail(id));
      if (prev) qc.setQueryData(noteKeys.detail(id), { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, { id }, ctx) => { if (ctx?.prev) qc.setQueryData(noteKeys.detail(id), ctx.prev); },
    onSuccess: (note) => {
      qc.setQueryData(noteKeys.detail(note.id), note);
      void qc.invalidateQueries({ queryKey: ['notes', 'list'] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('notes').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

export function useCopyNote() {
  const create = useCreateNote();
  return useMutation({
    mutationFn: (note: Note) => create.mutateAsync({ title: `${note.title} (copy)`.slice(0, 200), content: note.content as JSONContent, content_text: note.content_text }),
  });
}
