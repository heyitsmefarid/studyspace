import { z } from 'zod';
import {
  AnalysisSchema, FlashcardItemSchema, PlanSessionSchema, PracticeItemSchema, QuizItemSchema, RecommendationItemSchema,
  type Analysis, type FlashcardsInputSchema, type FlashcardsResult, type GeneratedQuestion, type PlanResult, type PlanSession,
  type PracticeInputSchema, type PracticeResult, type QuizInputSchema, type QuizResult, type RecommendationsInputSchema,
  type RecommendationsResult, type StudyPlanInputSchema, type TextResult,
} from './schemas.ts';

export type Finalized<T> = { ok: true; data: T } | { ok: false; reason: 'invalid' | 'empty'; detail: string };
const ok = <T>(data: T): Finalized<T> => ({ ok: true, data });
const invalid = (detail: string): Finalized<never> => ({ ok: false, reason: 'invalid', detail });
const empty = (detail: string): Finalized<never> => ({ ok: false, reason: 'empty', detail });

// ───────────── JSON extraction
export function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* try the outermost object */ }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try { return JSON.parse(t.slice(start, end + 1)); } catch { return undefined; }
}

// ───────────── similarity
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'is', 'are', 'what', 'which', 'and', 'or', 'for', 'on', 'does', 'do', 'how', 'why']);
export function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)));
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
const isDuplicate = (t: Set<string>, seen: Set<string>[]) => seen.some((s) => jaccard(t, s) >= 0.8);

// ───────────── quiz helpers
const norm = (s: string) => s.trim().toLowerCase();
const LETTER_PREFIX = /^\(?([A-Fa-f])[).:]\s+/;

export function stripOptionLetters(options: string[]): string[] {
  const all = options.every((o, i) => {
    const m = LETTER_PREFIX.exec(o.trim());
    return m && m[1]!.toUpperCase().charCodeAt(0) - 65 === i;
  });
  return all ? options.map((o) => o.trim().replace(LETTER_PREFIX, '').trim()) : options.map((o) => o.trim());
}

export function snapAnswer(answer: string, options: string[]): string | null {
  const a = answer.trim();
  const exact = options.find((o) => norm(o) === norm(a));
  if (exact) return exact;
  const letter = /^\(?([A-Fa-f])\)?[.:)]?$/.exec(a);
  if (letter) return options[letter[1]!.toUpperCase().charCodeAt(0) - 65] ?? null;
  const prefixed = LETTER_PREFIX.exec(a);
  if (prefixed) {
    const rest = a.replace(LETTER_PREFIX, '');
    return options.find((o) => norm(o) === norm(rest)) ?? options[prefixed[1]!.toUpperCase().charCodeAt(0) - 65] ?? null;
  }
  return null;
}

const TF_TYPES = new Set(['tf', 'true_false', 'true/false', 'truefalse', 'boolean', 'true-false']);
function tfAnswer(v: unknown): 'True' | 'False' | null {
  const s = norm(String(v));
  if (['true', 't', 'yes', 'correct'].includes(s)) return 'True';
  if (['false', 'f', 'no', 'incorrect'].includes(s)) return 'False';
  return null;
}

function normalizeQuizItem(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = { ...(raw as Record<string, unknown>) };
  r.options ??= r.choices;
  r.correctAnswer ??= r.answer ?? r.correct_answer;
  if (r.correctAnswer === undefined && typeof r.correctIndex === 'number' && Array.isArray(r.options)) r.correctAnswer = r.options[r.correctIndex];
  const type = typeof r.type === 'string' ? norm(r.type) : '';
  const opts = Array.isArray(r.options) ? r.options.map(String) : [];
  const looksTf = TF_TYPES.has(type) || (opts.length === 2 && opts.every((o) => tfAnswer(o) !== null));
  if (looksTf) {
    const ans = tfAnswer(r.correctAnswer);
    if (!ans) return null;
    return { ...r, type: 'tf', options: ['True', 'False'], correctAnswer: ans };
  }
  return { ...r, type: 'mcq' };
}

// ───────────── finalizers
export function finalizeText(raw: unknown): Finalized<TextResult> {
  if (typeof raw !== 'string') return invalid('Expected text');
  const text = raw.trim().replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/, '').trim();
  return text ? ok({ text }) : empty('Empty reply');
}

function listFrom(raw: unknown, ...keys: string[]): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return null;
  for (const k of keys) {
    const v = (raw as Record<string, unknown>)[k];
    if (Array.isArray(v)) return v;
  }
  return null;
}

export function finalizeFlashcards(raw: unknown, input: z.output<typeof FlashcardsInputSchema>): Finalized<FlashcardsResult> {
  const list = listFrom(raw, 'cards', 'flashcards');
  if (!list) return invalid('Expected {"cards": [...]}');
  if (list.length === 0) return empty('No cards returned');
  const seen = input.existing.map(tokens);
  const cards: FlashcardsResult['cards'] = [];
  let valid = 0;
  for (const item of list) {
    const r0 = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const parsed = FlashcardItemSchema.safeParse({ ...r0, question: r0.question ?? r0.front, answer: r0.answer ?? r0.back });
    if (!parsed.success) continue;
    valid++;
    const t = tokens(parsed.data.question);
    if (isDuplicate(t, seen)) continue;
    seen.push(t);
    cards.push(parsed.data);
    if (cards.length >= input.count) break;
  }
  if (cards.length > 0) return ok({ cards });
  return valid > 0 ? empty('Every card duplicated one you already have') : invalid('No card had a question and an answer');
}

export function finalizeQuiz(raw: unknown, input: z.output<typeof QuizInputSchema>): Finalized<QuizResult> {
  const list = listFrom(raw, 'questions', 'quiz');
  if (!list) return invalid('Expected {"questions": [...]}');
  if (list.length === 0) return empty('No questions returned');
  const title = raw && typeof raw === 'object' && typeof (raw as { title?: unknown }).title === 'string' ? ((raw as { title: string }).title.trim().slice(0, 200) || undefined) : undefined;
  const seen: Set<string>[] = [];
  const questions: GeneratedQuestion[] = [];
  let valid = 0;
  for (const item of list) {
    const n = normalizeQuizItem(item);
    if (!n) continue;
    const parsed = QuizItemSchema.safeParse(n);
    if (!parsed.success) continue;
    const q = parsed.data;
    let options: string[];
    let correct: string | null;
    if (q.type === 'tf') { options = ['True', 'False']; correct = tfAnswer(q.correctAnswer); }
    else {
      const stripped = stripOptionLetters(q.options);
      options = stripped.filter((o, i) => o && stripped.findIndex((x) => norm(x) === norm(o)) === i);
      correct = options.length >= 2 ? snapAnswer(q.correctAnswer, options) : null;
      if (correct && options.length > 6) options = [correct, ...options.filter((o) => o !== correct).slice(0, 5)];
    }
    if (!correct) continue;
    valid++;
    if (!input.types.includes(q.type)) continue;
    const t = tokens(q.question);
    if (isDuplicate(t, seen)) continue;
    seen.push(t);
    questions.push({ type: q.type, question: q.question, options, correctAnswer: correct, explanation: q.explanation, difficulty: q.difficulty, topic: q.topic });
    if (questions.length >= input.count) break;
  }
  if (questions.length > 0) return ok({ title, questions });
  return valid > 0 ? empty('No questions matched the requested types') : invalid('No question had valid options and a correct answer');
}

export function finalizePractice(raw: unknown, input: z.output<typeof PracticeInputSchema>): Finalized<PracticeResult> {
  const list = listFrom(raw, 'questions');
  if (!list) return invalid('Expected {"questions": [...]}');
  if (list.length === 0) return empty('No questions returned');
  const seen: Set<string>[] = [];
  const questions: PracticeResult['questions'] = [];
  for (const item of list) {
    const p = PracticeItemSchema.safeParse(item);
    if (!p.success) continue;
    const t = tokens(p.data.question);
    if (isDuplicate(t, seen)) continue;
    seen.push(t);
    questions.push(p.data);
    if (questions.length >= input.count) break;
  }
  return questions.length ? ok({ questions }) : invalid('No usable practice questions');
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export function finalizePlan(raw: unknown, input: z.output<typeof StudyPlanInputSchema>): Finalized<PlanResult> {
  const list = listFrom(raw, 'sessions', 'plan');
  if (!list) return invalid('Expected {"summary": "...", "sessions": [...]}');
  const summary = raw && typeof raw === 'object' && typeof (raw as { summary?: unknown }).summary === 'string' ? (raw as { summary: string }).summary.trim().slice(0, 600) : '';
  const budget = Math.round(input.hoursPerDay * 60);
  const maxDuration = Math.min(180, Math.max(15, budget));
  const parsed: PlanSession[] = [];
  for (const item of list) {
    const p = PlanSessionSchema.safeParse(item);
    if (!p.success) continue;
    const s = p.data;
    if (s.date < input.today || s.date > input.examDate) continue;
    const dur = Number.isFinite(s.durationMinutes) ? Math.round(s.durationMinutes) : 60;
    parsed.push({ date: s.date, startTime: s.startTime ?? null, topic: s.topic, durationMinutes: Math.min(maxDuration, Math.max(15, dur)), activity: s.activity, priority: s.priority, ...(s.notes ? { notes: s.notes } : {}) });
  }
  if (list.length > 0 && parsed.length === 0) return invalid('No sessions fell between today and the exam');
  if (parsed.length === 0) return empty('No sessions returned');
  const byDay = new Map<string, PlanSession[]>();
  for (const s of parsed) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const kept: PlanSession[] = [];
  let trimmed = 0;
  for (const day of byDay.values()) {
    let used = 0;
    for (const s of [...day].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])) {
      if (used + s.durationMinutes > budget && used > 0) { trimmed++; continue; }
      used += s.durationMinutes;
      kept.push(s);
    }
  }
  kept.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
  return ok({ summary, sessions: kept, trimmed });
}

export function finalizeAnalysis(raw: unknown): Finalized<Analysis> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid('Expected an analysis object');
  const p = AnalysisSchema.safeParse(raw);
  if (!p.success) return invalid('Analysis did not match the shape');
  const a = p.data;
  const data: Analysis = {
    ...a,
    weakTopics: a.weakTopics.slice(0, 8), strongTopics: a.strongTopics.slice(0, 8),
    commonMistakes: a.commonMistakes.slice(0, 6), reviewTopics: a.reviewTopics.slice(0, 8),
    suggestedFlashcards: a.suggestedFlashcards.slice(0, 10),
  };
  const nothing = !data.weakTopics.length && !data.strongTopics.length && !data.commonMistakes.length && !data.nextSession && !data.encouragement;
  return nothing ? empty('Analysis was empty') : ok(data);
}

export function finalizeRecommendations(raw: unknown, input: z.output<typeof RecommendationsInputSchema>): Finalized<RecommendationsResult> {
  const list = listFrom(raw, 'items', 'recommendations');
  if (!list) return invalid('Expected {"items": [...]}');
  const ids: Record<string, Set<string>> = {
    review_deck: new Set(input.decks.map((d) => d.id)),
    take_quiz: new Set(input.quizzes.map((q) => q.id)),
    open_note: new Set(input.notes.map((n) => n.id)),
    plan_exam: new Set(input.upcomingExams.map((e) => e.id)),
    start_session: new Set<string>(),
  };
  const items: RecommendationsResult['items'] = [];
  for (const item of list) {
    const p = RecommendationItemSchema.safeParse(item);
    if (!p.success) continue;
    const { type, targetId } = p.data.action;
    items.push({ ...p.data, action: { type, targetId: targetId && ids[type]!.has(targetId) ? targetId : undefined } });
    if (items.length >= 4) break;
  }
  return items.length ? ok({ items }) : empty('No recommendations');
}
