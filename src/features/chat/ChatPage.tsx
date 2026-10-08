import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOurRoom } from '@/features/realtime/RealtimeProvider';
import { useConnection } from '@/features/realtime/useRealtime';
import { useMarkRead, useUnread } from '@/features/notifications/api';
import { loadAround, useMessages, useOutbox } from './api';
import { flatten, type MessagePages } from './cache';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { SearchPanel } from './SearchPanel';
import { TypingIndicator } from './TypingIndicator';
import { useTyping } from './useTyping';
import type { ChatMessage } from './types';

export default function ChatPage() {
  const { partner } = useAuth();
  const room = useOurRoom().data;
  const messages = useMessages();
  const { partnerTyping, notifyTyping } = useTyping();
  const { messageIds } = useUnread();
  const markRead = useMarkRead();
  const [searching, setSearching] = useState(false);
  const [around, setAround] = useState<{ list: ChatMessage[]; id: string } | null>(null);
  const unreadKey = messageIds.join(',');
  const status = useConnection();
  const outbox = useOutbox();

  // Messages that failed while offline are retried once the room channel is live again (Retry stays available).
  useEffect(() => {
    if (status !== 'live') return;
    for (const m of flatten(messages.data as MessagePages | undefined)) if (m.pending === 'failed') outbox.retry(m.id).catch(() => { /* stays failed, with Retry */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on (re)connect
  }, [status]);

  // While the chat is open, its message notifications count as read.
  useEffect(() => {
    if (unreadKey) markRead.mutate(unreadKey.split(','));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the unread set changes
  }, [unreadKey]);

  if (!partner) {
    return <EmptyState title="Our Room is waiting for two" body="Invite your partner and this becomes your shared chat."
      action={<Link to="/settings/partner" className="text-primary underline">Invite your partner</Link>} />;
  }

  const jump = async (m: ChatMessage) => {
    try { setAround({ list: await loadAround(room!, m), id: m.id }); }
    catch (e) { toast.error(friendlyMessage(e)); }
  };
  const live = flatten(messages.data as MessagePages | undefined);

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-96 flex-col gap-3 md:h-[calc(100dvh-5rem)]">
      <ChatHeader onSearch={() => setSearching(true)} />
      {around && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm">
          Showing an older part of the conversation.
          <Button size="sm" variant="secondary" onClick={() => setAround(null)}>Back to latest</Button>
        </div>
      )}
      {messages.isPending ? <Skeleton className="flex-1" /> : (
        <MessageList
          messages={around ? around.list : live}
          hasOlder={!around && Boolean(messages.hasNextPage)}
          loadOlder={() => messages.fetchNextPage()}
          highlightId={around?.id}
          footer={partnerTyping ? <TypingIndicator name={partner.display_name || 'Your partner'} /> : null}
        />
      )}
      {!messages.isPending && live.length === 0 && !around && <p className="text-center text-sm text-ink-muted">Say hi, this is your shared corner of the sky ✦</p>}
      <Composer onTyping={notifyTyping} />
      <SearchPanel open={searching} onOpenChange={setSearching} onPick={(m) => void jump(m)} />
    </div>
  );
}
