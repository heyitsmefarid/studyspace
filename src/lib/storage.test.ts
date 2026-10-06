import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { objectPath, opensInline, safeContentType, safeFileName } from './storage';

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

describe('attachment content types', () => {
  it('stores script-capable types as opaque binaries', () => {
    for (const t of ['text/html', 'application/xhtml+xml', 'image/svg+xml', 'text/xml', 'application/xml', 'application/javascript', 'text/javascript', 'TEXT/HTML; charset=utf-8']) {
      expect(safeContentType(t)).toBe('application/octet-stream');
    }
    expect(safeContentType('')).toBe('application/octet-stream');
    expect(safeContentType('application/pdf')).toBe('application/pdf');
    expect(safeContentType('image/png')).toBe('image/png');
    expect(safeContentType('application/x-custom-thing')).toBe('application/octet-stream');
    expect(safeContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
  it('opens only images and PDFs inline; everything else downloads', () => {
    expect(opensInline('image/jpeg')).toBe(true);
    expect(opensInline('application/pdf')).toBe(true);
    expect(opensInline('image/svg+xml')).toBe(false);
    expect(opensInline('text/html')).toBe(false);
    expect(opensInline('application/zip')).toBe(false);
  });
});
