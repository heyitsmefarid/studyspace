export const NOTIFICATION_KINDS = [
  { kind: 'deadline', label: 'Deadlines', hint: 'One-off tasks due within a day.' },
  { kind: 'exam', label: 'Exams', hint: 'Three days and one day before.' },
  { kind: 'study_reminder', label: 'Study reminders', hint: 'When you haven\'t studied by your usual time.' },
  { kind: 'message', label: 'Messages and shooting stars', hint: 'From your partner in Our Room.' },
  { kind: 'shared_note', label: 'Shared notes', hint: 'When your partner shares or updates a note.' },
  { kind: 'shared_deck', label: 'Shared decks', hint: 'When your partner shares or updates a deck.' },
  { kind: 'achievement', label: 'Achievements', hint: 'When you unlock one.' },
  { kind: 'streak', label: 'Streaks', hint: 'Your milestones and your partner\'s.' },
] as const;

/** Matches private.notify: a kind is on unless it is explicitly switched off. */
export const kindEnabled = (kinds: Record<string, boolean>, kind: string) => kinds[kind] !== false;
