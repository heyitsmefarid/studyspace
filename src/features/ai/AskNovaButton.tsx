import { useNavigate } from 'react-router';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { CONTEXT_TYPES, TutorMode } from '@/services/ai/schemas';

export type NovaContextType = (typeof CONTEXT_TYPES)[number];

export function tutorUrl(context: { type: NovaContextType; id: string }, mode: TutorMode = 'explain_simply', prompt?: string) {
  return `/tutor?context=${context.type}:${context.id}&mode=${mode}${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ''}`;
}

export function AskNovaButton({ context, mode = 'explain_simply', prompt, label = 'Ask Nova about this', variant = 'secondary', size = 'md' }: {
  context: { type: NovaContextType; id: string };
  mode?: TutorMode;
  prompt?: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const navigate = useNavigate();
  return (
    <Button variant={variant} size={size} onClick={() => navigate(tutorUrl(context, mode, prompt))}>
      <Sparkles className="size-4 text-gold" aria-hidden /> {label}
    </Button>
  );
}
