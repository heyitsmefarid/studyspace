export type Permission = NotificationPermission | 'unsupported';
export type Arrival = 'system' | 'mark-read' | 'silent' | 'toast';

export const systemAllowed = (enabled: boolean, permission: Permission) => enabled && permission === 'granted';

/**
 * What to do when a notification arrives live. Hidden tab + system notifications allowed → a system notification;
 * a message while the chat is open → mark it read; a shooting star → its overlay announces it; otherwise a toast.
 */
export function arrivalAction(
  n: { kind: string; dedupe_key: string | null },
  ctx: { pathname: string; hidden: boolean; systemAllowed: boolean },
): Arrival {
  if (ctx.hidden && ctx.systemAllowed) return 'system';
  if (n.kind === 'message' && ctx.pathname === '/chat' && !ctx.hidden) return 'mark-read';
  if (n.dedupe_key?.startsWith('star:')) return 'silent';
  return 'toast';
}
