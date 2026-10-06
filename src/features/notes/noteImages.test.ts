import { describe, expect, it, vi } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import { copyNoteImages, rewriteImagePaths, storageImagePaths } from './noteImages';

const img = (path: string | null): JSONContent => ({ type: 'storageImage', attrs: { path, alt: 'x' } });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

// Review P9: a copied note kept pointing at the original's image files, so it broke when the original went away.
describe('storageImagePaths', () => {
  it('collects every stored image once, however deeply nested', () => {
    const d = doc(img('u1/n1/a.png'), { type: 'bulletList', content: [{ type: 'listItem', content: [img('u1/n1/b.png'), img('u1/n1/a.png')] }] });
    expect(storageImagePaths(d)).toEqual(['u1/n1/a.png', 'u1/n1/b.png']);
  });
  it('ignores other nodes and images without a stored path', () => {
    expect(storageImagePaths(doc({ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }, img(null), { type: 'image', attrs: { src: 'https://x' } }))).toEqual([]);
  });
});

describe('rewriteImagePaths', () => {
  it('swaps mapped paths and leaves the input untouched', () => {
    const d = doc(img('u1/n1/a.png'), img('u1/n1/b.png'));
    const out = rewriteImagePaths(d, new Map([['u1/n1/a.png', 'u2/n2/a.png']]));
    expect(storageImagePaths(out)).toEqual(['u2/n2/a.png', 'u1/n1/b.png']);
    expect(storageImagePaths(d)).toEqual(['u1/n1/a.png', 'u1/n1/b.png']);
  });
});

describe('copyNoteImages', () => {
  it('re-uploads each image into the new note and points the content at the copies', async () => {
    const download = vi.fn(async (path: string) => new Blob([path], { type: 'image/png' }));
    const upload = vi.fn(async (file: File) => `me/new/${file.name}`);
    const r = await copyNoteImages(doc(img('partner/n1/0f8fad5b-d9cb-469f-a165-70867728950e-cat.png'), img('partner/n1/0f8fad5b-d9cb-469f-a165-70867728950e-cat.png')), { download, upload });
    expect(download).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0]![0].name).toBe('cat.png');
    expect(storageImagePaths(r.content)).toEqual(['me/new/cat.png']);
    expect(r.failed).toBe(0);
  });

  it('keeps the original path for an image that could not be copied, and counts it', async () => {
    const r = await copyNoteImages(doc(img('partner/n1/a.png'), img('partner/n1/b.png')), {
      download: async (p) => { if (p.endsWith('a.png')) throw new Error('gone'); return new Blob(['b']); },
      upload: async () => 'me/new/b.png',
    });
    expect(storageImagePaths(r.content)).toEqual(['partner/n1/a.png', 'me/new/b.png']);
    expect(r.failed).toBe(1);
  });

  it('does nothing for a note without images', async () => {
    const download = vi.fn();
    const d = doc({ type: 'paragraph' });
    const r = await copyNoteImages(d, { download, upload: vi.fn() });
    expect(r).toEqual({ content: d, failed: 0 });
    expect(download).not.toHaveBeenCalled();
  });
});
