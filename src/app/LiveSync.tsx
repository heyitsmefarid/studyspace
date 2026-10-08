import { useNotificationArrivals } from '@/features/notifications/toasts';
import { useReminderRefresh } from '@/features/notifications/reminders';
import { useChatSync } from '@/features/chat/sync';
import { useSpaceSync } from '@/features/space/api';
import { useOrbitSync } from '@/features/space/useOrbit';

/** App-wide live behaviour that renders nothing. Mounted once inside the RealtimeProvider. */
export function LiveSync() {
  useNotificationArrivals();
  useReminderRefresh();
  useChatSync();
  useSpaceSync();
  useOrbitSync();
  return null;
}
