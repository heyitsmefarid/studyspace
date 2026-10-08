import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTableChange } from '@/features/realtime/useRealtime';
import { addIncomingNotification, useMarkRead, type AppNotification } from './api';
import { arrivalAction, systemAllowed } from './arrival';
import { showSystemNotification, systemPermission } from './browserNotify';

/** Mounted once: puts live notifications in the cache and announces them (toast / system notification). */
export function useNotificationArrivals() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { preferences } = useAuth();
  const markRead = useMarkRead();
  const ctx = useRef({ pathname, browser: preferences.notifications.browser });
  useEffect(() => { ctx.current = { pathname, browser: preferences.notifications.browser }; });

  useTableChange('notifications', (change) => {
    if (change.eventType !== 'INSERT') return;
    const n = change.new as AppNotification;
    addIncomingNotification(qc, n);
    const open = () => { markRead.mutate([n.id]); navigate(n.link ?? '/notifications'); };
    const action = arrivalAction(n, {
      pathname: ctx.current.pathname,
      hidden: document.hidden,
      systemAllowed: systemAllowed(ctx.current.browser, systemPermission()),
    });
    if (action === 'system') showSystemNotification(n, open);
    else if (action === 'mark-read') markRead.mutate([n.id]);
    else if (action === 'toast') toast(n.title, { description: n.body || undefined, action: { label: 'Open', onClick: open } });
  });
}
