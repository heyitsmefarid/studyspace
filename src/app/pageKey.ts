/** Key for the page-entrance wrapper: changes only when a different route renders (not on params or query). */
export const pageKey = (matches: readonly { id: string }[]) => matches.at(-1)?.id ?? 'root';
