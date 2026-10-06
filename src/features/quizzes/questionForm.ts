import { z } from 'zod';

const norm = (s: string) => s.trim().toLowerCase();

export const QuestionFormSchema = z.object({
  type: z.enum(['mcq', 'tf']),
  question: z.string().trim().min(1, 'Write the question').max(1000),
  options: z.array(z.string()).optional(),
  correct_answer: z.string().trim(),
  explanation: z.string().trim().max(2000).default(''),
  topic: z.string().trim().max(60).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
}).transform((q) => ({ ...q, options: q.type === 'tf' ? ['True', 'False'] : (q.options ?? []).map((o) => o.trim()).filter(Boolean) }))
  .superRefine((q, ctx) => {
    if (q.type === 'mcq') {
      if (q.options.length < 2 || q.options.length > 6) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Use 2 to 6 options' });
      if (new Set(q.options.map(norm)).size !== q.options.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options must be different' });
    }
    if (!q.options.some((o) => norm(o) === norm(q.correct_answer))) ctx.addIssue({ code: 'custom', path: ['correct_answer'], message: 'Pick the correct answer' });
  });

export type QuestionForm = z.output<typeof QuestionFormSchema>;

export function validateQuestion(input: unknown): { ok: true; value: QuestionForm } | { ok: false; errors: Record<string, string> } {
  const r = QuestionFormSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  const errors: Record<string, string> = {};
  for (const i of r.error.issues) errors[String(i.path[0] ?? 'form')] ??= i.message;
  return { ok: false, errors };
}
