import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, attachmentProblem, escapeLike } from './rules';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50% a_b \\ c')).toBe('50\\% a\\_b \\\\ c');
    expect(escapeLike('plain')).toBe('plain');
  });
});

describe('attachmentProblem', () => {
  it('rejects empty and oversized files', () => {
    expect(attachmentProblem({ size: 0 })).toBe('That file is empty.');
    expect(attachmentProblem({ size: MAX_FILE_BYTES + 1 })).toBe('Files can be up to 10 MB.');
    expect(attachmentProblem({ size: MAX_FILE_BYTES })).toBeNull();
  });
});
