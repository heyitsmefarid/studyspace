import { describe, expect, it } from 'vitest';
import { nextSubjectColor, SUBJECT_COLORS } from './colors';

describe('subject colours', () => {
  it('picks the first unused colour, cycling when all are used', () => {
    expect(nextSubjectColor([])).toBe(SUBJECT_COLORS[0]);
    expect(nextSubjectColor([SUBJECT_COLORS[0]!.toLowerCase()])).toBe(SUBJECT_COLORS[1]);
    expect(nextSubjectColor([...SUBJECT_COLORS])).toBe(SUBJECT_COLORS[0]);
  });
});
