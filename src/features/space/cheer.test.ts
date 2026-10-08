import { describe, expect, it } from 'vitest';
import { STAR_MAX } from '@/features/chat/rules';
import { STAR_PRESETS, cheerFor } from './cheer';

describe('cheerFor', () => {
  it('picks a cheer for each kind of activity', () => {
    expect(cheerFor({ kind: 'session', title: 'Biology' })).toBe('🔥 Nice session!');
    expect(cheerFor({ kind: 'quiz', title: 'Quiz' })).toBe('👏 Great quiz!');
    expect(cheerFor({ kind: 'achievement', title: 'Binary Star' })).toBe('✦ Congrats on Binary Star!');
    expect(cheerFor({ kind: 'shared_note', title: 'Cells' })).toBe('💛 Thanks for sharing!');
  });
  it('always fits in a shooting star', () => {
    expect(cheerFor({ kind: 'achievement', title: 'x'.repeat(300) }).length).toBeLessThanOrEqual(STAR_MAX);
    for (const p of STAR_PRESETS) expect(p.length).toBeLessThanOrEqual(STAR_MAX);
  });
});
