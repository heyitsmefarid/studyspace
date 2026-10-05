import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins truthy classes and lets later Tailwind classes win', () => {
    const hidden = false as boolean;
    expect(cn('p-2 text-sm', hidden && 'hidden', 'p-4')).toBe('text-sm p-4');
  });
});
