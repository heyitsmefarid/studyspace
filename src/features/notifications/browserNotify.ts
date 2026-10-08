import type { Permission } from './arrival';

export const systemPermission = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

export async function requestSystemPermission(): Promise<Permission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

/** A system notification that focuses the tab and runs `onOpen` when clicked. Never throws. */
export function showSystemNotification(n: { id: string; title: string; body: string }, onOpen: () => void) {
  try {
    const sys = new Notification(n.title, { body: n.body, tag: n.id, icon: '/favicon.svg' });
    sys.onclick = () => { window.focus(); onOpen(); sys.close(); };
  } catch {
    // some mobile browsers only allow notifications from a service worker; the bell still has it
  }
}
