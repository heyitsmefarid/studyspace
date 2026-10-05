import type { JSONContent } from '@tiptap/react';

const p = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h = (level: number, text: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const task = (text: string): JSONContent => ({ type: 'taskItem', attrs: { checked: false }, content: [p(text)] });
const bullet = (text: string): JSONContent => ({ type: 'listItem', content: [p(text)] });

export function buildWelcomeNote(name: string) {
  const intro = 'Every study session becomes a star. Here is the loop that makes StudySpace work:';
  const steps = [
    'Write or paste notes here.',
    'Open the ✦ Nova menu: Summarize, Explain, Generate flashcards, Generate quiz.',
    'Review your cards — dim stars brighten as you master them.',
    "Take a quiz and read Nova's analysis.",
    'Let Nova build a study plan, then add it to your calendar.',
    'Start a study session and watch your sky fill up.',
  ];
  const tips = ['Press Ctrl+K anywhere for quick actions.', 'Select text in a note and ask Nova about just that part.', 'You can delete this note any time.'];
  const heading = `Hi ${name}, welcome to your sky`;
  const content: JSONContent = {
    type: 'doc',
    content: [h(1, heading), p(intro), { type: 'taskList', content: steps.map(task) }, h(2, 'Tips'), { type: 'bulletList', content: tips.map(bullet) }],
  };
  return { title: 'Welcome to StudySpace ✦', content, content_text: [heading, intro, ...steps, 'Tips', ...tips].join('\n\n') };
}
