import { useNotificationArrivals } from '@/features/notifications/toasts';
import { useReminderRefresh } from '@/features/notifications/reminders';

/** App-wide live behaviour that renders nothing. Mounted once inside the RealtimeProvider. */
export function LiveSync() {
  useNotificationArrivals();
  useReminderRefresh();
  return null;
}
