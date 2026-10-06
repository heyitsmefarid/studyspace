import type { JSONContent } from '@tiptap/react';

const UPLOAD_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/;

function visit(node: JSONContent, fn: (n: JSONContent) => void) {
  fn(node);
  for (const child of node.content ?? []) visit(child, fn);
}

/** Storage paths of the uploaded images in a note, in order, without repeats. */
export function storageImagePaths(content: JSONContent): string[] {
  const paths = new Set<string>();
  visit(content, (n) => {
    const path = n.type === 'storageImage' ? (n.attrs?.path as unknown) : null;
    if (typeof path === 'string' && path) paths.add(path);
  });
  return [...paths];
}

/** A copy of the content with stored image paths swapped through `map`. */
export function rewriteImagePaths(content: JSONContent, map: Map<string, string>): JSONContent {
  const next = map.get(content.attrs?.path as string);
  return {
    ...content,
    ...(content.type === 'storageImage' && next ? { attrs: { ...content.attrs, path: next } } : {}),
    ...(content.content ? { content: content.content.map((c) => rewriteImagePaths(c, map)) } : {}),
  };
}

/**
 * Gives a copied note its own image files, so it survives the original being deleted or unshared.
 * An image that can't be copied keeps its original path (it still shows while the original exists).
 */
export async function copyNoteImages(content: JSONContent, deps: {
  download: (path: string) => Promise<Blob>;
  upload: (file: File) => Promise<string>;
}): Promise<{ content: JSONContent; failed: number }> {
  const paths = storageImagePaths(content);
  if (paths.length === 0) return { content, failed: 0 };
  const map = new Map<string, string>();
  let failed = 0;
  for (const path of paths) {
    try {
      const blob = await deps.download(path);
      const name = (path.split('/').pop() ?? 'image').replace(UPLOAD_PREFIX, '') || 'image';
      map.set(path, await deps.upload(new File([blob], name, { type: blob.type })));
    } catch {
      failed++;
    }
  }
  return { content: rewriteImagePaths(content, map), failed };
}
