import { describe, expect, it } from 'vitest';
import { layoutOurSky, type OurSession } from './ourSky';

const NOW = new Date('2026-10-08T12:00:00Z');
const s = (id: string, start: string, end: string, together = false): OurSession =>
  ({ id, subject_id: null, focus_seconds: 1500, started_at: start, ended_at: end, together });
const opts = (width: number) => ({ width, now: NOW, meColor: '#7CC4FF', partnerColor: '#FF9ECF' });

describe('layoutOurSky', () => {
  it('puts the two halves side by side on wide screens', () => {
    const l = layoutOurSky([s('a', '2026-10-08T01:00:00Z', '2026-10-08T01:30:00Z')], [s('b', '2026-10-08T02:00:00Z', '2026-10-08T02:30:00Z')], [], opts(1000));
    expect(l.row).toBe(true);
    expect(l.height).toBe(280);
    expect(l.stars.find((x) => x.id === 'b')!.x).toBeGreaterThanOrEqual(500);
  });
  it('stacks them on phones', () => {
    const l = layoutOurSky([s('a', '2026-10-08T01:00:00Z', '2026-10-08T01:30:00Z')], [s('b', '2026-10-08T02:00:00Z', '2026-10-08T02:30:00Z')], [], opts(375));
    expect(l.row).toBe(false);
    expect(l.height).toBe(400);
    expect(l.stars.find((x) => x.id === 'b')!.y).toBeGreaterThanOrEqual(200);
  });
  it('links only overlapping sessions that are both marked together', () => {
    const me = [s('a', '2026-10-08T01:00:00Z', '2026-10-08T01:30:00Z', true), s('c', '2026-10-08T05:00:00Z', '2026-10-08T05:30:00Z', true)];
    const partner = [s('b', '2026-10-08T01:10:00Z', '2026-10-08T01:40:00Z', true), s('d', '2026-10-08T05:00:00Z', '2026-10-08T05:30:00Z')];
    expect(layoutOurSky(me, partner, [], opts(1000)).links).toEqual([{ from: 'a', to: 'b' }]);
  });
});
