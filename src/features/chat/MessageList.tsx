import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ArrowDown } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TZ } from '@/features/gamification/streak';
import { groupMessages } from './grouping';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from './types';

/** Stays pinned to the newest message when already there; otherwise offers a "New messages" pill. Loads older pages near the top. */
export function MessageList({ messages, hasOlder, loadOlder, highlightId, footer }: {
  messages: ChatMessage[]; hasOlder: boolean; loadOlder: () => Promise<unknown>; highlightId?: string | null; footer?: ReactNode;
}) {
  const { profile } = useAuth();
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const loading = useRef(false);
  const [showPill, setShowPill] = useState(false);
  const [now] = useState(() => new Date());
  const lastId = messages.at(-1)?.id;
  const days = groupMessages(messages, profile?.timezone ?? DEFAULT_TZ, now);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (restore.current) {
      el.scrollTop = el.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else if (lastId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- scroll position lives in the DOM, so the pill can only be decided after layout
      setShowPill(true);
    }
  }, [messages.length, lastId]);

  useEffect(() => {
    if (highlightId) box.current?.querySelector(`[data-mid="${highlightId}"]`)?.scrollIntoView({ block: 'center' });
  }, [highlightId]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setShowPill(false);
    if (el.scrollTop < 120 && hasOlder && !loading.current) {
      loading.current = true;
      restore.current = { height: el.scrollHeight, top: el.scrollTop };
      void loadOlder().finally(() => { loading.current = false; });
    }
  };
  const toBottom = () => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
    setShowPill(false);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={box} onScroll={onScroll} className="h-full overflow-y-auto px-1 py-3" aria-live="polite" aria-relevant="additions">
        {days.map((d) => (
          <section key={d.key} aria-label={d.label} className="mb-4">
            <p className="sticky top-0 z-10 mx-auto mb-2 w-fit rounded-full bg-surface-2/90 px-3 py-0.5 text-xs text-ink-muted backdrop-blur">{d.label}</p>
            <div className="flex flex-col gap-3">
              {d.clusters.map((c) => (
                <div key={c.key} className="flex flex-col gap-1">
                  {c.messages.map((m) => <div key={m.id} data-mid={m.id}><MessageBubble m={m} highlight={m.id === highlightId} /></div>)}
                  <p className={c.senderId === profile?.id ? 'text-right text-[11px] text-ink-faint' : 'text-[11px] text-ink-faint'}>
                    {format(new Date(c.messages.at(-1)!.created_at), 'p')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
        {footer}
      </div>
      {showPill && (
        <button onClick={toBottom} className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 animate-pop-in items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-ink shadow-glow">
          New messages <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
