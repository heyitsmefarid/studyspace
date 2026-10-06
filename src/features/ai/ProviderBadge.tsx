import { Badge } from '@/components/ui/Badge';
import type { AiMeta } from '@/services/ai/types';

export function ProviderBadge({ meta }: { meta?: AiMeta }) {
  if (!meta) return null;
  const [self, other] = meta.provider === 'gemini' ? ['Gemini', 'Groq'] : ['Groq', 'Gemini'];
  const name = meta.provider === 'gemini' ? '✦ Gemini' : '⚡ Groq';
  const title = meta.fellBack ? `${other} was busy, so ${self} answered` : `Answered by ${meta.model || self}`;
  const left = meta.remainingToday;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-faint">
      <Badge tone="neutral" title={title}>{name}</Badge>
      {left !== undefined && left <= 20 && <span>{left} Nova {left === 1 ? 'request' : 'requests'} left today</span>}
    </span>
  );
}
