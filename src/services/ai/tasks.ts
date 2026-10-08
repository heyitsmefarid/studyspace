import type { z } from 'zod';
import type { AiTask, ChatMessage, ProviderName } from './types.ts';
import {
  ExplainInputSchema, FlashcardsInputSchema, JSON_SHAPES, PracticeInputSchema, QuizAnalysisInputSchema, QuizInputSchema,
  RecommendationsInputSchema, ScanAttachmentInputSchema, SimplifyInputSchema, StudyGuideInputSchema, StudyPlanInputSchema, SummarizeInputSchema, TutorInputSchema,
} from './schemas.ts';
import {
  buildAnalysisPrompt, buildFlashcardsPrompt, buildPlanPrompt, buildPracticePrompt, buildQuizPrompt, buildRecommendationsPrompt,
  buildSourcePrompt, buildTutorPrompt, EXPLAIN_SYSTEM_PROMPT, SCAN_ATTACHMENT_SYSTEM_PROMPT, SIMPLIFY_SYSTEM_PROMPT, STUDY_GUIDE_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT,
} from './prompts.ts';
import {
  finalizeAnalysis, finalizeFlashcards, finalizePlan, finalizePractice, finalizeQuiz, finalizeRecommendations, finalizeText, type Finalized,
} from './postprocess.ts';

export interface TaskDef {
  input: z.ZodType;
  structured: boolean;
  primary: ProviderName;
  temperature: number;
  maxOutputTokens: number;
  jsonSchema?: Record<string, unknown>;
  build(input: unknown): { system: string; messages: ChatMessage[] };
  finalize(raw: unknown, input: unknown): Finalized<unknown>;
}

function def<S extends z.ZodType>(d: {
  input: S; structured: boolean; primary?: ProviderName; temperature: number; maxOutputTokens: number; jsonSchema?: Record<string, unknown>;
  build(i: z.output<S>): { system: string; messages: ChatMessage[] };
  finalize(raw: unknown, i: z.output<S>): Finalized<unknown>;
}): TaskDef {
  return { primary: 'gemini', ...d } as TaskDef;
}

export const TASK_DEFS: Record<AiTask, TaskDef> = {
  tutor: def({ input: TutorInputSchema, structured: false, temperature: 0.6, maxOutputTokens: 4096, build: buildTutorPrompt, finalize: (r) => finalizeText(r) }),
  summarize: def({ input: SummarizeInputSchema, structured: false, temperature: 0.3, maxOutputTokens: 4096, build: (i) => buildSourcePrompt(SUMMARY_SYSTEM_PROMPT, i), finalize: (r) => finalizeText(r) }),
  explain: def({ input: ExplainInputSchema, structured: false, temperature: 0.4, maxOutputTokens: 4096, build: (i) => buildSourcePrompt(EXPLAIN_SYSTEM_PROMPT, i), finalize: (r) => finalizeText(r) }),
  simplify: def({ input: SimplifyInputSchema, structured: false, temperature: 0.3, maxOutputTokens: 8192, build: (i) => buildSourcePrompt(SIMPLIFY_SYSTEM_PROMPT, i), finalize: (r) => finalizeText(r) }),
  study_guide: def({ input: StudyGuideInputSchema, structured: false, temperature: 0.4, maxOutputTokens: 8192, build: (i) => buildSourcePrompt(STUDY_GUIDE_SYSTEM_PROMPT, i), finalize: (r) => finalizeText(r) }),
  scan_attachment: def({ input: ScanAttachmentInputSchema, structured: false, temperature: 0.2, maxOutputTokens: 4096, build: (i) => ({ system: SCAN_ATTACHMENT_SYSTEM_PROMPT, messages: [{ role: 'user', content: `Scan this attachment${i.title ? ` titled "${i.title}"` : ''}${i.subject ? ` for ${i.subject}` : ''}.` }] }), finalize: (r) => finalizeText(r) }),
  flashcards: def({ input: FlashcardsInputSchema, structured: true, temperature: 0.5, maxOutputTokens: 8192, jsonSchema: JSON_SHAPES.flashcards, build: buildFlashcardsPrompt, finalize: finalizeFlashcards }),
  quiz: def({ input: QuizInputSchema, structured: true, temperature: 0.5, maxOutputTokens: 8192, jsonSchema: JSON_SHAPES.quiz, build: buildQuizPrompt, finalize: finalizeQuiz }),
  practice: def({ input: PracticeInputSchema, structured: true, primary: 'groq', temperature: 0.6, maxOutputTokens: 4096, jsonSchema: JSON_SHAPES.practice, build: buildPracticePrompt, finalize: finalizePractice }),
  study_plan: def({ input: StudyPlanInputSchema, structured: true, temperature: 0.3, maxOutputTokens: 8192, jsonSchema: JSON_SHAPES.study_plan, build: buildPlanPrompt, finalize: finalizePlan }),
  quiz_analysis: def({ input: QuizAnalysisInputSchema, structured: true, temperature: 0.3, maxOutputTokens: 4096, jsonSchema: JSON_SHAPES.quiz_analysis, build: buildAnalysisPrompt, finalize: (r) => finalizeAnalysis(r) }),
  recommendations: def({ input: RecommendationsInputSchema, structured: true, temperature: 0.4, maxOutputTokens: 2048, jsonSchema: JSON_SHAPES.recommendations, build: buildRecommendationsPrompt, finalize: finalizeRecommendations }),
};

export function primaryFor(task: AiTask, input: unknown): ProviderName {
  if (task === 'tutor' && (input as { fast?: boolean } | null)?.fast) return 'groq';
  return TASK_DEFS[task].primary;
}
