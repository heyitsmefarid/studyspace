export const RANKS = [
  { name: 'Stardust', minLevel: 1 },
  { name: 'Comet', minLevel: 3 },
  { name: 'Moon', minLevel: 5 },
  { name: 'Planet', minLevel: 8 },
  { name: 'Star', minLevel: 12 },
  { name: 'Nebula', minLevel: 17 },
  { name: 'Galaxy', minLevel: 25 },
] as const;
export type RankName = (typeof RANKS)[number]['name'];

export const xpForLevel = (n: number) => 50 * n * (n - 1);

export function levelFromXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp));
  let n = 1;
  while (xpForLevel(n + 1) <= safe) n++;
  return n;
}

export function rankForLevel(level: number): RankName {
  let rank: RankName = 'Stardust';
  for (const r of RANKS) if (level >= r.minLevel) rank = r.name;
  return rank;
}

export function levelProgress(xp: number) {
  const safe = Math.max(0, Math.floor(xp));
  const level = levelFromXp(safe);
  const base = xpForLevel(level);
  const needed = xpForLevel(level + 1) - base;
  const into = safe - base;
  return { level, rank: rankForLevel(level), into, needed, pct: into / needed };
}
