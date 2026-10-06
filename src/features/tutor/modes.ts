import { AlignLeft, Coffee, HelpCircle, Lightbulb, Shapes, Telescope, type LucideIcon } from 'lucide-react';
import type { ContextType } from './context';
import type { TutorMode } from '@/services/ai/schemas';

export const MODE_META: Record<TutorMode, { label: string; icon: LucideIcon }> = {
  explain_simply: { label: 'Explain simply', icon: Lightbulb },
  deep: { label: 'Deep dive', icon: Telescope },
  quiz_me: { label: 'Quiz me', icon: HelpCircle },
  examples: { label: 'Examples', icon: Shapes },
  summarize: { label: 'Summarize', icon: AlignLeft },
  study_with_me: { label: 'Study with me', icon: Coffee },
};

export const modeMeta = (m: string) => MODE_META[m as TutorMode] ?? MODE_META.explain_simply;

const NOUN: Record<ContextType, string> = { note: 'note', deck: 'deck', quiz: 'quiz', attempt: 'attempt', plan: 'plan', subject: 'subject' };

export function startersFor(mode: TutorMode, context: ContextType | null): string[] {
  if (context === 'attempt') {
    return ['Help me understand the questions I got wrong', 'Why was my answer wrong on the first mistake?', 'Quiz me on my weak topics', 'What should I review first?'];
  }
  if (context === 'plan') return ['What should I focus on today?', 'Make tonight’s session more effective', 'Quiz me on the first topic', 'I’m behind — how do I catch up?'];
  if (context) {
    const n = NOUN[context];
    return [`Explain the hardest part of this ${n}`, `Quiz me on this ${n}`, 'Give me examples', `Summarize this ${n} in 5 bullets`];
  }
  switch (mode) {
    case 'quiz_me': return ['Quiz me on cell biology', 'Quiz me on World War I causes', 'Quiz me on derivatives', 'Quiz me on Spanish verbs'];
    case 'deep': return ['Deep dive: how does the immune system remember?', 'Deep dive: what is entropy?', 'Deep dive: how do neural networks learn?', 'Deep dive: why do markets crash?'];
    case 'examples': return ['Examples of irony', 'Examples of Newton’s third law', 'Examples of opportunity cost', 'Examples of a logical fallacy'];
    case 'summarize': return ['Summarize the French Revolution', 'Summarize how DNA replicates', 'Summarize supply and demand', 'Summarize the causes of climate change'];
    case 'study_with_me': return ['Study with me for 30 minutes', 'Help me start my essay', 'Let’s review for my exam', 'I can’t focus — help me get going'];
    default: return ['What is a derivative, really?', 'How do vaccines work?', 'Explain photosynthesis simply', 'What is opportunity cost?'];
  }
}
