import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  log: [] as string[],
  files: [] as { storage_path: string }[],
  deleteError: null as unknown,
  removeError: null as unknown,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ eq: async () => { db.log.push(`list ${table}`); return { data: db.files, error: null }; } }),
      delete: () => ({ eq: async () => { db.log.push(`delete ${table}`); return { error: db.deleteError }; } }),
    }),
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => { db.log.push(`remove ${bucket} ${paths.join(',')}`); return { data: [], error: db.removeError }; },
      }),
    },
  },
}));

import { deleteNote } from './api';

// Review P9: deleting a note left its uploaded images and files in Storage forever.
describe('deleteNote', () => {
  beforeEach(() => {
    db.log.length = 0;
    db.files = [{ storage_path: 'u1/n1/a.png' }, { storage_path: 'u1/n1/b.pdf' }];
    db.deleteError = null;
    db.removeError = null;
  });

  it('deletes the note, then its stored files', async () => {
    await deleteNote('n1');
    expect(db.log).toEqual(['list note_attachments', 'delete notes', 'remove note-files u1/n1/a.png,u1/n1/b.pdf']);
  });

  it('keeps the files when the note could not be deleted', async () => {
    db.deleteError = { code: '42501', message: 'permission denied' };
    await expect(deleteNote('n1')).rejects.toThrow();
    expect(db.log).toEqual(['list note_attachments', 'delete notes']);
  });

  it('still counts as deleted when only the file clean-up fails', async () => {
    db.removeError = { message: 'storage unavailable' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(deleteNote('n1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('skips Storage when the note has no files', async () => {
    db.files = [];
    await deleteNote('n1');
    expect(db.log).toEqual(['list note_attachments', 'delete notes']);
  });
});
