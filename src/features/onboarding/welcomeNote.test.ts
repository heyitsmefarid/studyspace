import { describe, expect, it } from 'vitest';
import { buildWelcomeNote } from './welcomeNote';

describe('buildWelcomeNote', () => {
  it('greets by name and mirrors the content as plain text', () => {
    const n = buildWelcomeNote('Mika');
    expect(n.title).toBe('Welcome to StudySpace ✦');
    expect(n.content.type).toBe('doc');
    expect(n.content_text).toContain('Mika');
    expect(n.content_text).toContain('Generate flashcards');
    expect(n.content_text.length).toBeLessThan(4000);
  });
});
