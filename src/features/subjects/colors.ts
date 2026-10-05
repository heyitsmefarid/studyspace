export const SUBJECT_COLORS = ['#A99CFF', '#5FE0C8', '#F5C76B', '#FF8A7A', '#7CC4FF', '#FF9ECF', '#9BE07A', '#FFB86B'];

export function nextSubjectColor(used: string[]): string {
  const set = new Set(used.map((c) => c.toUpperCase()));
  return SUBJECT_COLORS.find((c) => !set.has(c.toUpperCase())) ?? SUBJECT_COLORS[0]!;
}
