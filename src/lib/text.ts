export function truncateAtBoundary(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  const slice = text.slice(0, max);
  for (const sep of ['\n\n', '\n']) {
    const i = slice.lastIndexOf(sep);
    if (i > 0) return { text: slice.slice(0, i).trimEnd(), truncated: true };
  }
  return { text: slice, truncated: true };
}

export function excerpt(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
