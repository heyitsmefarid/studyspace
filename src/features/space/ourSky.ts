import { layoutSky, type SkyLine, type SkySession, type SkyStar, type SkySubject } from '@/features/dashboard/sky';

export interface OurSession extends SkySession { ended_at: string }
export interface OurStar extends SkyStar { owner: 'me' | 'partner' }
export interface OurSkyLayout { width: number; height: number; row: boolean; stars: OurStar[]; lines: SkyLine[]; links: { from: string; to: string }[] }

const overlaps = (a: OurSession, b: OurSession) =>
  Date.parse(a.started_at) < Date.parse(b.ended_at) && Date.parse(b.started_at) < Date.parse(a.ended_at);

/** Two skies side by side (≥ 768 px) or stacked, joined by gold links where the two of you studied together. */
export function layoutOurSky(me: OurSession[], partner: OurSession[], subjects: SkySubject[],
  opts: { width: number; now: Date; meColor: string; partnerColor: string; maxStars?: number }): OurSkyLayout {
  const row = opts.width >= 768;
  const halfW = row ? Math.floor(opts.width / 2) : opts.width;
  const halfH = row ? 280 : 200;
  const mine = layoutSky(me, subjects, { width: halfW, height: halfH, now: opts.now, meColor: opts.meColor, maxStars: opts.maxStars });
  const theirs = layoutSky(partner, subjects, { width: halfW, height: halfH, now: opts.now, meColor: opts.partnerColor, maxStars: opts.maxStars });
  const dx = row ? halfW : 0;
  const dy = row ? 0 : halfH;
  const stars: OurStar[] = [
    ...mine.stars.map((s) => ({ ...s, owner: 'me' as const })),
    ...theirs.stars.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy, owner: 'partner' as const })),
  ];
  const shown = new Set(stars.map((s) => s.id));
  const links: { from: string; to: string }[] = [];
  for (const a of me) {
    if (!a.together || !shown.has(a.id)) continue;
    for (const b of partner) if (b.together && shown.has(b.id) && overlaps(a, b)) links.push({ from: a.id, to: b.id });
  }
  return { width: opts.width, height: row ? halfH : halfH * 2, row, stars, lines: [...mine.lines, ...theirs.lines], links };
}
