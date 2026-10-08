import { z } from 'zod';

export const MAX_SOURCE_CHARS = 24_000;
export const MAX_CONTEXT_CHARS = 12_000;
export const MAX_HISTORY = 20;

export const TUTOR_MODES = ['explain_simply', 'deep', 'quiz_me', 'examples', 'summarize', 'study_with_me'] as const;
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export const LEVELS = ['easy', 'medium', 'hard'] as const;
export const ACTIVITIES = ['learn', 'review', 'flashcards', 'practice quiz', 'mock exam', 'rest'] as const;
export const PRIORITIES = ['high', 'medium', 'low'] as const;
export const CONTEXT_TYPES = ['note', 'deck', 'quiz', 'attempt', 'plan', 'subject'] as const;
export const REC_ACTIONS = ['review_deck', 'take_quiz', 'open_note', 'plan_exam', 'start_session'] as const;
export const STUDY_TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

const str = (max: number) => z.string().trim().min(1).max(max);
const optStr = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
/** AI-output enum: trims + lowercases, falls back instead of failing. */
const looseEnum = <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(values)).catch(fallback);

// ───────────── inputs
export const ChatMessageSchema = z.object({ role: z.enum(['user', 'assistant']), content: str(8000) });
const SourceSchema = z.object({ text: str(MAX_SOURCE_CHARS), title: optStr(200), subject: optStr(80) });
export const ScanAttachmentInputSchema = z.object({ data: z.string().min(32).max(12_000_000), mimeType: z.string().trim().min(3).max(120), title: optStr(200), subject: optStr(80) });

export const TutorInputSchema = z.object({
  mode: z.enum(TUTOR_MODES),
  difficulty: z.enum(DIFFICULTIES),
  messages: z.array(ChatMessageSchema).min(1).max(MAX_HISTORY)
    .refine((m) => m[m.length - 1]?.role === 'user', 'The last message must be from the student'),
  context: z.object({ type: z.enum(CONTEXT_TYPES), title: z.string().trim().max(200), text: str(MAX_CONTEXT_CHARS) }).optional(),
  fast: z.boolean().optional(),
});
export const SummarizeInputSchema = SourceSchema;
export const ExplainInputSchema = SourceSchema.extend({ focus: optStr(500) });
export const SimplifyInputSchema = SourceSchema;
export const StudyGuideInputSchema = SourceSchema;
export const FlashcardsInputSchema = SourceSchema.extend({
  count: z.number().int().min(5).max(30).default(12),
  existing: z.array(z.string().max(300)).max(300).default([]),
});
export const QuizInputSchema = SourceSchema.extend({
  count: z.number().int().min(5).max(25).default(10),
  types: z.array(z.enum(['mcq', 'tf'])).min(1).default(['mcq', 'tf']),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
});
export const PracticeInputSchema = SourceSchema.extend({ count: z.number().int().min(3).max(15).default(6) });
export const StudyPlanInputSchema = z.object({
  subject: str(80),
  today: isoDate,
  examDate: isoDate,
  topics: z.array(z.object({ name: str(120), confidence: z.number().int().min(1).max(5) })).min(1).max(30),
  hoursPerDay: z.number().min(0.5).max(12),
  preferredTimes: z.array(z.enum(STUDY_TIMES)).min(1),
}).refine((v) => v.examDate > v.today, { message: 'The exam date must be after today', path: ['examDate'] });
export const QuizAnalysisInputSchema = z.object({
  quizTitle: str(200),
  subject: optStr(80),
  durationSeconds: z.number().int().min(0),
  questions: z.array(z.object({
    question: str(1000), topic: z.string().trim().max(60), difficulty: optStr(20),
    correctAnswer: str(500), chosen: z.string().max(500).nullable(), correct: z.boolean(),
  })).min(1).max(50),
});
const RefSchema = z.object({ id: z.string().max(64), title: z.string().max(200) });
export const RecommendationsInputSchema = z.object({
  today: isoDate,
  dueCards: z.number().int().min(0),
  studyMinutesThisWeek: z.number().min(0),
  streak: z.number().int().min(0),
  decks: z.array(RefSchema.extend({ masteryPct: z.number().min(0).max(100), due: z.number().int().min(0) })).max(10),
  quizzes: z.array(RefSchema).max(5),
  notes: z.array(RefSchema).max(5),
  weakTopics: z.array(z.object({ topic: z.string().max(60), subject: optStr(80) })).max(10),
  upcomingExams: z.array(RefSchema.extend({ date: isoDate, subject: optStr(80) })).max(5),
});

export type TutorInput = z.input<typeof TutorInputSchema>;
export type SourceInput = z.input<typeof SourceSchema>;
export type ScanAttachmentInput = z.input<typeof ScanAttachmentInputSchema>;
export type ExplainInput = z.input<typeof ExplainInputSchema>;
export type FlashcardsInput = z.input<typeof FlashcardsInputSchema>;
export type QuizInput = z.input<typeof QuizInputSchema>;
export type PracticeInput = z.input<typeof PracticeInputSchema>;
export type StudyPlanInput = z.input<typeof StudyPlanInputSchema>;
export type QuizAnalysisInput = z.input<typeof QuizAnalysisInputSchema>;
export type RecommendationsInput = z.input<typeof RecommendationsInputSchema>;

// ───────────── outputs (validated item-by-item in postprocess.ts)
export const FlashcardItemSchema = z.object({
  question: str(300), answer: str(600),
  difficulty: looseEnum(LEVELS, 'medium'),
  topic: z.string().trim().min(1).max(60).catch('General'),
});
export const QuizItemSchema = z.object({
  type: looseEnum(['mcq', 'tf'] as const, 'mcq'),
  question: str(500),
  options: z.array(z.coerce.string().trim().min(1).max(200)).min(2).max(8),
  correctAnswer: z.coerce.string().trim().min(1).max(200),
  explanation: z.string().trim().max(800).catch(''),
  difficulty: looseEnum(LEVELS, 'medium'),
  topic: z.string().trim().min(1).max(60).catch('General'),
});
export const PracticeItemSchema = z.object({
  question: str(600), answer: str(1500),
  hint: z.string().trim().max(300).catch(''),
  explanation: z.string().trim().max(1000).catch(''),
  topic: z.string().trim().min(1).max(60).catch('General'),
});
export const PlanSessionSchema = z.object({
  date: isoDate,
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().catch(null),
  topic: str(120),
  durationMinutes: z.coerce.number().catch(60),
  activity: looseEnum(ACTIVITIES, 'review'),
  priority: looseEnum(PRIORITIES, 'medium'),
  notes: z.string().trim().max(300).optional().catch(undefined),
});
/** Array that keeps only the items that parse (one bad item never discards the rest). */
const lenientArray = <T extends z.ZodType>(item: T) =>
  z.array(z.unknown()).catch([]).transform((xs) => xs.flatMap((x) => {
    const r = item.safeParse(x);
    return r.success ? [r.data as z.output<T>] : [];
  }));
const TopicReason = z.object({ topic: str(60), reason: z.string().trim().max(300).catch('') });
export const AnalysisSchema = z.object({
  weakTopics: lenientArray(TopicReason),
  strongTopics: lenientArray(TopicReason),
  commonMistakes: lenientArray(z.string().trim().min(1).max(300)),
  reviewTopics: lenientArray(z.string().trim().min(1).max(60)),
  suggestedFlashcards: lenientArray(z.object({ question: str(300), answer: str(600), topic: z.string().trim().max(60).catch('General') })),
  nextSession: z.object({
    topic: str(120),
    durationMinutes: z.coerce.number().int().min(10).max(240).catch(30),
    activity: looseEnum(ACTIVITIES, 'review'),
    why: z.string().trim().max(300).catch(''),
  }).nullable().catch(null),
  encouragement: z.string().trim().max(300).catch(''),
});
export const RecommendationItemSchema = z.object({
  title: str(120),
  reason: z.string().trim().max(300).catch(''),
  action: z.object({ type: z.enum(REC_ACTIONS), targetId: z.string().max(64).optional().catch(undefined) }),
});

export interface TextResult { text: string }
export type GeneratedCard = z.output<typeof FlashcardItemSchema>;
export interface FlashcardsResult { cards: GeneratedCard[] }
export interface GeneratedQuestion { type: 'mcq' | 'tf'; question: string; options: string[]; correctAnswer: string; explanation: string; difficulty: (typeof LEVELS)[number]; topic: string }
export interface QuizResult { title?: string; questions: GeneratedQuestion[] }
export type PracticeQuestion = z.output<typeof PracticeItemSchema>;
export interface PracticeResult { questions: PracticeQuestion[] }
export interface PlanSession { date: string; startTime: string | null; topic: string; durationMinutes: number; activity: (typeof ACTIVITIES)[number]; priority: (typeof PRIORITIES)[number]; notes?: string }
export interface PlanResult { summary: string; sessions: PlanSession[]; trimmed: number }
export type Analysis = z.output<typeof AnalysisSchema>;
export type Recommendation = z.output<typeof RecommendationItemSchema>;
export interface RecommendationsResult { items: Recommendation[] }

// ───────────── response schemas sent to Gemini (subset of JSON Schema it supports)
const S = { str: { type: 'string' }, int: { type: 'integer' } } as const;
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const arr = (items: unknown) => ({ type: 'array', items });
const en = (values: readonly string[]) => ({ type: 'string', enum: [...values] });

export const JSON_SHAPES = {
  flashcards: obj({ cards: arr(obj({ question: S.str, answer: S.str, difficulty: en(LEVELS), topic: S.str })) }),
  quiz: obj({ title: S.str, questions: arr(obj({ type: en(['mcq', 'tf']), question: S.str, options: arr(S.str), correctAnswer: S.str, explanation: S.str, difficulty: en(LEVELS), topic: S.str })) }),
  practice: obj({ questions: arr(obj({ question: S.str, answer: S.str, hint: S.str, explanation: S.str, topic: S.str })) }),
  study_plan: obj({ summary: S.str, sessions: arr(obj({ date: S.str, startTime: S.str, topic: S.str, durationMinutes: S.int, activity: en(ACTIVITIES), priority: en(PRIORITIES), notes: S.str }, ['date', 'topic', 'durationMinutes', 'activity', 'priority'])) }),
  quiz_analysis: obj({
    weakTopics: arr(obj({ topic: S.str, reason: S.str })), strongTopics: arr(obj({ topic: S.str, reason: S.str })),
    commonMistakes: arr(S.str), reviewTopics: arr(S.str),
    suggestedFlashcards: arr(obj({ question: S.str, answer: S.str, topic: S.str })),
    nextSession: obj({ topic: S.str, durationMinutes: S.int, activity: en(ACTIVITIES), why: S.str }),
    encouragement: S.str,
  }),
  recommendations: obj({ items: arr(obj({ title: S.str, reason: S.str, action: obj({ type: en(REC_ACTIONS), targetId: S.str }, ['type']) })) }),
} as const;
