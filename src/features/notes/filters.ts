import type { Tables } from '@/lib/supabase';

export type NoteListItem = Pick<Tables<'notes'>, 'id' | 'owner_id' | 'title' | 'subject_id' | 'folder_id' | 'is_pinned' | 'is_favorite' | 'is_shared' | 'updated_at'> & { excerpt: string };
export interface NoteFilters { scope: 'mine' | 'shared'; subjectId?: string; folderId?: string; pinned?: boolean; favorite?: boolean }

export function sortNotes(items: NoteListItem[]): NoteListItem[] {
  return [...items].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at));
}

export function applyLocalFilters(items: NoteListItem[], f: NoteFilters, uid: string): NoteListItem[] {
  return items.filter((x) =>
    (f.scope === 'mine' ? x.owner_id === uid : x.owner_id !== uid) &&
    (!f.subjectId || x.subject_id === f.subjectId) &&
    (!f.folderId || x.folder_id === f.folderId) &&
    (!f.pinned || x.is_pinned) &&
    (!f.favorite || x.is_favorite));
}
