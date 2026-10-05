import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { objectPath, safeFileName } from './storage';

describe('storage paths', () => {
  it('sanitises file names', () => {
    expect(safeFileName('My Notes (final)!.pdf')).toBe('my-notes-final.pdf');
    expect(safeFileName('../../etc/passwd')).toBe('etc-passwd');
    expect(safeFileName('')).toBe('file');
  });
  it('joins uid-first object paths', () => {
    expect(objectPath('u1', 'n1', 'a.png')).toBe('u1/n1/a.png');
  });
});
