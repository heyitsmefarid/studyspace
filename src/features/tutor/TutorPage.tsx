import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessagesSquare, Paperclip, X } from 'lucide-react';
import { friendlyMessage } from '@/lib/errors';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { DIFFICULTIES, TUTOR_MODES, type Difficulty, type TutorMode } from '@/services/ai/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { touchConversation, tutorKeys, useConversation, useCreateConversation, type ConversationData } from './api';
import { loadContext, parseContextParam, type ContextType } from './context';
import { useTutorChat } from './useTutorChat';
import { ConversationList } from './ConversationList';
import { ChatView } from './ChatView';
import { Composer } from './Composer';
import { ModeBar } from './ModeBar';
import { startersFor } from './modes';

const isMode = (v: string | null | undefined): v is TutorMode => (TUTOR_MODES as readonly string[]).includes(v ?? '');
const isDifficulty = (v: string | null | undefined): v is Difficulty => (DIFFICULTIES as readonly string[]).includes(v ?? '');

export default function TutorPage() {
  const { conversationId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { preferences } = useAuth();
  const create = useCreateConversation();
  const [listOpen, setListOpen] = useState(false);
  const [newMode, setNewMode] = useState<TutorMode>(() => (isMode(params.get('mode')) ? params.get('mode') as TutorMode : 'explain_simply'));
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>(preferences.ai.difficulty);
  const [fast, setFast] = useState(preferences.ai.fastMode);
  const [contextDropped, setContextDropped] = useState(false);

  const convQ = useConversation(conversationId);
  const conversation = convQ.data?.conversation ?? null;
  const mode: TutorMode = conversation ? (isMode(conversation.mode) ? conversation.mode : 'explain_simply') : newMode;
  const difficulty: Difficulty = conversation ? (isDifficulty(conversation.difficulty) ? conversation.difficulty : 'intermediate') : newDifficulty;

  // Study material: from the saved conversation, or ?context=type:id on a new one.
  const ctxRef: { type: ContextType; id: string } | null = conversation
    ? (conversation.context_type && conversation.context_id ? { type: conversation.context_type as ContextType, id: conversation.context_id } : null)
    : contextDropped ? null : parseContextParam(params.get('context'));
  const ctxQ = useQuery({
    queryKey: ['tutor-context', ctxRef?.type, ctxRef?.id],
    enabled: Boolean(ctxRef),
    staleTime: Infinity,
    retry: false,
    queryFn: () => loadContext(ctxRef!.type, ctxRef!.id),
  });
  const context = ctxRef && ctxQ.data ? { type: ctxRef.type, title: ctxQ.data.title, text: ctxQ.data.text } : null;

  const chat = useTutorChat(conversationId, {
    mode, difficulty, fast, context,
    create: (first) => create.mutateAsync({
      title: first.slice(0, 60), mode, difficulty,
      context_type: context?.type ?? null, context_id: ctxRef?.id ?? null, context_title: context?.title ?? null,
    }),
    onCreated: (id) => navigate(`/tutor/${id}`, { replace: true }),
  });

  const patchConversation = (patch: { mode?: TutorMode; difficulty?: Difficulty }) => {
    if (!conversation) return;
    qc.setQueryData<ConversationData>(tutorKeys.detail(conversation.id), (d) => (d ? { ...d, conversation: { ...d.conversation, ...patch } } : d));
    touchConversation(conversation.id, patch).catch((e: unknown) => toast.error(friendlyMessage(e)));
  };
  const setMode = (m: TutorMode) => (conversation ? patchConversation({ mode: m }) : setNewMode(m));
  const setDifficulty = (d: Difficulty) => (conversation ? patchConversation({ difficulty: d }) : setNewDifficulty(d));

  const starters = startersFor(mode, ctxRef ? ctxRef.type : null);
  const welcome = (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-gold-soft font-display text-2xl text-gold shadow-glow">✦</span>
      <div>
        <h2 className="font-display text-2xl">Hi, I&apos;m Nova</h2>
        <p className="mt-1 max-w-md text-ink-muted">Ask anything — I&apos;ll explain, quiz you, or study alongside you. Pick a mode above to change how I answer.</p>
      </div>
      <div className="flex max-w-xl flex-wrap justify-center gap-2">
        {starters.map((s) => (
          <button key={s} type="button" onClick={() => void chat.send(s)} disabled={chat.busy}
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm hover:border-primary hover:text-primary disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
    </div>
  );

  let body;
  if (chat.missing) {
    body = <EmptyState title="This conversation is gone" body="It may have been deleted." action={<Link to="/tutor" className="text-primary underline">Start a new one</Link>} />;
  } else if (chat.loading) {
    body = <div className="flex flex-col gap-3"><Skeleton className="h-16 w-2/3" /><Skeleton className="ml-auto h-12 w-1/2" /><Skeleton className="h-24 w-3/4" /></div>;
  } else {
    body = (
      <ChatView messages={chat.messages} sending={chat.sending} error={chat.error} canRetry={chat.canRetry} onRetry={chat.retry}
        remainingToday={chat.remainingToday} empty={welcome} />
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
      <aside className="hidden lg:block">
        <div className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <ConversationList activeId={conversationId} />
        </div>
      </aside>

      <section className="flex min-h-[calc(100dvh-10rem)] min-w-0 flex-col gap-4">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Your chats" onClick={() => setListOpen(true)}>
              <MessagesSquare className="size-5" />
            </Button>
            <h1 className="min-w-0 flex-1 truncate font-display text-2xl">{conversation?.title ?? 'Nova'}</h1>
          </div>
          {ctxRef && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm text-primary">
                <Paperclip className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {ctxQ.isPending ? 'Loading your material…' : ctxQ.isError ? 'The original material is gone' : `Studying: ${ctxQ.data?.title}`}
                </span>
                {!conversation && (
                  <button type="button" onClick={() => setContextDropped(true)} aria-label="Don't use this material"><X className="size-3.5" /></button>
                )}
              </span>
              {ctxQ.data?.truncated && <Badge tone="gold">Long — Nova sees the first part</Badge>}
            </div>
          )}
          <ModeBar mode={mode} onMode={setMode} difficulty={difficulty} onDifficulty={setDifficulty} fast={fast} onFast={setFast} />
        </header>

        <div className="flex-1">{body}</div>

        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 bg-bg/90 px-4 pb-3 pt-2 backdrop-blur md:bottom-0 md:mx-0 md:px-0">
          <Composer
            key={conversationId ?? `new:${params.get('prompt') ?? ''}`}
            initial={conversationId ? '' : params.get('prompt') ?? ''}
            busy={chat.busy}
            onSend={chat.send}
          />
          <p className="mt-1.5 text-center text-[11px] text-ink-faint">Nova can make mistakes — check important facts against your notes.</p>
        </div>
      </section>

      <Sheet open={listOpen} onOpenChange={setListOpen} side="left" title="Your chats">
        <ConversationList activeId={conversationId} onNavigate={() => setListOpen(false)} />
      </Sheet>
    </div>
  );
}
