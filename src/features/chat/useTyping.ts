import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRoomEvent, useSendRoomEvent, useTableChange } from '@/features/realtime/useRealtime';
import { TYPING_SHOW_MS, shouldSendTyping } from './typing';

/** "<partner> is typing…" for 4 s after their last typing event, cleared when their message lands. */
export function useTyping() {
  const { user, partner } = useAuth();
  const send = useSendRoomEvent();
  const lastSent = useRef<number | null>(null);
  const [heardAt, setHeardAt] = useState<number | null>(null);
  useRoomEvent('typing', (p) => { if (p.userId === partner?.id) setHeardAt(Date.now()); });
  useTableChange('messages', (c) => {
    if (c.eventType === 'INSERT' && (c.new as { sender_id?: string }).sender_id === partner?.id) setHeardAt(null);
  });
  useEffect(() => {
    if (heardAt === null) return;
    const t = window.setTimeout(() => setHeardAt(null), TYPING_SHOW_MS);
    return () => window.clearTimeout(t);
  }, [heardAt]);
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!shouldSendTyping(lastSent.current, now)) return;
    lastSent.current = now;
    send('typing', { userId: user?.id });
  }, [send, user?.id]);
  return { partnerTyping: heardAt !== null, notifyTyping };
}
