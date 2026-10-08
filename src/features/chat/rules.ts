export const TEXT_MAX = 4000;
export const STAR_MAX = 140;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Escapes LIKE wildcards so a search for "50%" or "a_b" matches literally. */
export const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

export function attachmentProblem(file: { size: number }): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'Files can be up to 10 MB.';
  return null;
}
