import { z } from 'zod';

const norm = (s: string) => s.trim().toLowerCase();

export const CardFormSchema = z.object({
  type: z.enum(['qa', 'mcq', 'tf']),
  front: z.string().trim().min(1, 'Write the question').max(1000),
  back: z.string().trim().max(2000).default(''),
  options: z.array(z.string()).optional(),
  correct_answer: z.string().trim().optional(),
  topic: z.string().trim().max(60).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  front_image_path: z.string().nullable().optional(),
  back_image_path: z.string().nullable().optional(),
}).transform((c) => ({ ...c, options: c.type === 'mcq' ? (c.options ?? []).map((o) => o.trim()).filter(Boolean) : c.type === 'tf' ? ['True', 'False'] : undefined }))
  .superRefine((c, ctx) => {
    if (c.type === 'qa' && !c.back) ctx.addIssue({ code: 'custom', path: ['back'], message: 'Write the answer' });
    if (c.type === 'mcq') {
      const opts = c.options ?? [];
      if (opts.length < 2 || opts.length > 6) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Use 2 to 6 options' });
      if (new Set(opts.map(norm)).size !== opts.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options must be different' });
      if (!opts.some((o) => norm(o) === norm(c.correct_answer ?? ''))) ctx.addIssue({ code: 'custom', path: ['correct_answer'], message: 'Pick the correct option' });
    }
    if (c.type === 'tf' && c.correct_answer !== 'True' && c.correct_answer !== 'False') ctx.addIssue({ code: 'custom', path: ['correct_answer'], message: 'Choose True or False' });
  });

export type CardForm = z.output<typeof CardFormSchema>;

export function validateCard(input: unknown): { ok: true; value: CardForm } | { ok: false; errors: Record<string, string> } {
  const r = CardFormSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) errors[String(issue.path[0] ?? 'form')] ??= issue.message;
  return { ok: false, errors };
}
