import type { RecommendationsInput } from '@/services/ai/schemas';

export function buildRecommendationsInput(d: {
  today: string; streak: number; minutesThisWeek: number;
  decks: { id: string; title: string; masteryPct: number; due: number }[];
  quizzes: { id: string; title: string }[]; notes: { id: string; title: string }[];
  weakTopics: { topic: string; subjectName?: string }[];
  exams: { id: string; title: string; date: string; subjectName?: string }[];
}): RecommendationsInput {
  const cut = (s: string, n: number) => s.slice(0, n);
  return {
    today: d.today,
    dueCards: d.decks.reduce((t, x) => t + x.due, 0),
    studyMinutesThisWeek: Math.round(d.minutesThisWeek),
    streak: d.streak,
    decks: [...d.decks].sort((a, b) => b.due - a.due).slice(0, 10).map((x) => ({ id: x.id, title: cut(x.title, 200), masteryPct: Math.round(x.masteryPct), due: x.due })),
    quizzes: d.quizzes.slice(0, 5).map((x) => ({ id: x.id, title: cut(x.title, 200) })),
    notes: d.notes.slice(0, 5).map((x) => ({ id: x.id, title: cut(x.title, 200) })),
    weakTopics: d.weakTopics.slice(0, 10).map((w) => ({ topic: cut(w.topic, 60), ...(w.subjectName ? { subject: cut(w.subjectName, 80) } : {}) })),
    upcomingExams: d.exams.slice(0, 5).map((e) => ({ id: e.id, title: cut(e.title, 200), date: e.date, ...(e.subjectName ? { subject: cut(e.subjectName, 80) } : {}) })),
  };
}

export function routeForAction(a: { type: string; targetId?: string }): string {
  switch (a.type) {
    case 'review_deck': return a.targetId ? `/decks/${a.targetId}/study` : '/decks';
    case 'take_quiz': return a.targetId ? `/quizzes/${a.targetId}/take?mode=practice` : '/quizzes';
    case 'open_note': return a.targetId ? `/notes/${a.targetId}` : '/notes';
    case 'plan_exam': return '/planner/ai';
    default: return '/study';
  }
}

export const recsCacheKey = (uid: string, date: string) => `ss.recs.${uid}.${date}`;
