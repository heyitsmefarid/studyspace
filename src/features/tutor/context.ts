import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { truncateAtBoundary } from '@/lib/text';
import { CONTEXT_TYPES, MAX_CONTEXT_CHARS, type PlanSession } from '@/services/ai/schemas';

export type ContextType = (typeof CONTEXT_TYPES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseContextParam(v: string | null): { type: ContextType; id: string } | null {
  if (!v) return null;
  const [type, id] = v.split(':');
  if (!type || !id || !(CONTEXT_TYPES as readonly string[]).includes(type) || !UUID.test(id)) return null;
  return { type: type as ContextType, id };
}

export const formatNoteContext = (title: string, text: string) => ({ title, text: `Note "${title}"\n\n${text}` });

export function formatDeckContext(title: string, cards: { front: string; back: string; type: string; correct_answer: string | null }[]) {
  const lines = cards.map((c) => `Q: ${c.front}\nA: ${c.type === 'qa' ? c.back : c.correct_answer ?? c.back}`);
  return { title, text: `Flashcard deck "${title}" (${cards.length} cards)\n\n${lines.join('\n\n')}` };
}

export function formatQuizContext(title: string, qs: { question: string; options: string[]; correctAnswer: string; explanation: string }[]) {
  const lines = qs.map((q, i) => `${i + 1}. ${q.question}\n   Options: ${q.options.join(' | ')}\n   Answer: ${q.correctAnswer}${q.explanation ? ` — ${q.explanation}` : ''}`);
  return { title, text: `Quiz "${title}" (${qs.length} questions)\n\n${lines.join('\n')}` };
}

export function formatAttemptContext(title: string, score: number, total: number, answers: { question: { question: string; correctAnswer: string; topic: string | null }; chosen: string | null; correct: boolean }[]) {
  const lines = answers.map((a) => a.correct
    ? `✓ ${a.question.question}`
    : `✗ ${a.question.question} — answered "${a.chosen ?? 'nothing'}", correct "${a.question.correctAnswer}"`);
  return { title, text: `Quiz attempt "${title}" — Score: ${score}/${total}\n\n${lines.join('\n')}` };
}

export function formatPlanContext(title: string, examDate: string, sessions: Pick<PlanSession, 'date' | 'startTime' | 'topic' | 'durationMinutes' | 'activity'>[]) {
  const lines = sessions.map((s) => `${s.date}${s.startTime ? ` ${s.startTime}` : ''} · ${s.activity} · ${s.topic} (${s.durationMinutes} min)`);
  return { title, text: `Study plan "${title}" — exam on ${examDate}\n\n${lines.join('\n')}` };
}

export function formatSubjectContext(name: string, notes: { title: string; content_text: string }[]) {
  const lines = notes.map((n) => `## ${n.title}\n${n.content_text.slice(0, 1500)}`);
  return { title: name, text: `Subject "${name}" — ${notes.length} notes\n\n${lines.join('\n\n')}` };
}

export async function loadContext(type: ContextType, id: string) {
  let ctx: { title: string; text: string };
  switch (type) {
    case 'note': {
      const n = unwrap(await supabase.from('notes').select('title, content_text').eq('id', id).single());
      ctx = formatNoteContext(n.title, n.content_text); break;
    }
    case 'deck': {
      const d = unwrap(await supabase.from('decks').select('title').eq('id', id).single());
      const cards = unwrap(await supabase.from('flashcards').select('front, back, type, correct_answer').eq('deck_id', id).order('position'));
      ctx = formatDeckContext(d.title, cards); break;
    }
    case 'quiz': {
      const q = unwrap(await supabase.from('quizzes').select('title').eq('id', id).single());
      const rows = unwrap(await supabase.from('quiz_questions').select('question, options, correct_answer, explanation').eq('quiz_id', id).order('position'));
      ctx = formatQuizContext(q.title, rows.map((r) => ({ question: r.question, options: r.options as string[], correctAnswer: r.correct_answer, explanation: r.explanation }))); break;
    }
    case 'attempt': {
      const a = unwrap(await supabase.from('quiz_attempts').select('title, score, total, answers').eq('id', id).single());
      ctx = formatAttemptContext(a.title, a.score, a.total, a.answers as never); break;
    }
    case 'plan': {
      const p = unwrap(await supabase.from('study_plans').select('title, exam_date, plan').eq('id', id).single());
      ctx = formatPlanContext(p.title, p.exam_date, (p.plan as unknown as { sessions?: PlanSession[] } | null)?.sessions ?? []); break;
    }
    case 'subject': {
      const s = unwrap(await supabase.from('subjects').select('name').eq('id', id).single());
      const notes = unwrap(await supabase.from('notes').select('title, content_text').eq('subject_id', id).order('updated_at', { ascending: false }).limit(8));
      ctx = formatSubjectContext(s.name, notes); break;
    }
  }
  const { text, truncated } = truncateAtBoundary(ctx.text, MAX_CONTEXT_CHARS);
  return { type, title: ctx.title, text, truncated };
}
