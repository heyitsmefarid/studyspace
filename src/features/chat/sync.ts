import { useQueryClient } from '@tanstack/react-query';
import { useOurRoom } from '@/features/realtime/RealtimeProvider';
import { useTableChange } from '@/features/realtime/useRealtime';
import { applyReaction, upsertMessage, type MessagePages } from './cache';
import { chatKeys, toMessage } from './api';

/** Mounted once: keeps the cached conversation in step with Realtime (new, deleted, reactions). */
export function useChatSync() {
  const qc = useQueryClient();
  const room = useOurRoom().data;
  useTableChange('messages', (c) => {
    if (!room || c.eventType === 'DELETE') return;
    const row = toMessage(c.new as Parameters<typeof toMessage>[0]);
    if (row.room_id !== room) return;
    qc.setQueryData<MessagePages>(chatKeys.messages(room), (d) => upsertMessage(d, row));
  });
  useTableChange('message_reactions', (c) => {
    if (!room) return;
    const r = (c.eventType === 'DELETE' ? c.old : c.new) as { message_id?: string; user_id?: string; emoji?: string };
    if (!r.message_id || !r.user_id || !r.emoji) return;
    qc.setQueryData<MessagePages>(chatKeys.messages(room), (d) =>
      applyReaction(d, { message_id: r.message_id!, user_id: r.user_id!, emoji: r.emoji! }, c.eventType === 'DELETE' ? 'remove' : 'add'));
  });
}
