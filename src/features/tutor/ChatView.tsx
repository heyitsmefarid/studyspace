import { useEffect, useRef, useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';
import { MarkdownView } from '@/features/ai/MarkdownView';
import { ProviderBadge } from '@/features/ai/ProviderBadge';
import { AiStatus } from '@/features/ai/AiStatus';
import type { AiError, ProviderName } from '@/services/ai/types';
import type { AiMessageRow } from './api';

const noop = () => {};

function NovaAvatar() {
  return <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-soft font-display text-gold shadow-glow">✦</span>;
}

export function ChatView({ messages, sending, error, canRetry, onRetry, remainingToday, empty }: {
  messages: AiMessageRow[]; sending: boolean; error: AiError | null; canRetry: boolean; onRetry: () => void;
  remainingToday?: number; empty: ReactNode;
}) {
  const end = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const lastAssistant = messages.findLast((m) => m.role === 'assistant');

  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setAtBottom(Boolean(entry?.isIntersecting)), { rootMargin: '0px 0px 120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Follow new messages only while the student is already at the bottom.
  useEffect(() => {
    if (atBottom) end.current?.scrollIntoView({ block: 'end' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll on new content, not when atBottom flips
  }, [messages.length, sending, error]);

  if (messages.length === 0 && !sending && !error) return <>{empty}</>;

  return (
    <div className="relative">
      <ol className="flex flex-col gap-4" aria-label="Conversation" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={cn('flex animate-rise-in gap-2', m.role === 'user' ? 'justify-end' : 'items-start')}>
            {m.role === 'assistant' && <NovaAvatar />}
            <div className={cn('flex min-w-0 max-w-[88%] flex-col gap-1', m.role === 'user' && 'items-end')}>
              <div className={cn(
                'rounded-2xl px-4 py-2.5',
                m.role === 'user' ? 'whitespace-pre-wrap rounded-br-md bg-primary-soft text-ink' : 'rounded-tl-md border border-line bg-surface',
              )}>
                {m.role === 'user' ? m.content : <MarkdownView markdown={m.content} className="text-[15px]" reveal={m.id === lastAssistant?.id} />}
              </div>
              <div className="flex flex-wrap items-center gap-2 px-1">
                <time className="text-[11px] text-ink-faint" dateTime={m.created_at}>{format(parseISO(m.created_at), 'HH:mm')}</time>
                {m.id === lastAssistant?.id && m.provider && (
                  <ProviderBadge meta={{ provider: m.provider as ProviderName, model: m.model ?? '', fellBack: m.fell_back, remainingToday }} />
                )}
              </div>
            </div>
          </li>
        ))}
        {sending && (
          <li className="flex items-center gap-2"><NovaAvatar /><ConstellationLoader /></li>
        )}
      </ol>
      {error && (
        <div className="mt-4">
          <AiStatus task={{ status: 'error', error, retry: canRetry ? onRetry : noop, cancel: noop }} />
        </div>
      )}
      <div ref={end} className="h-px scroll-mb-40" />
      {!atBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
          className="fixed bottom-40 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-raised px-3 py-1.5 text-xs font-semibold shadow-glow md:bottom-28"
        >
          <ArrowDown className="size-3.5" /> Jump to latest
        </button>
      )}
    </div>
  );
}
