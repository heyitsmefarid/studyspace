export interface PresenceMeta { userId: string; status: 'online' | 'studying'; subject?: string | null; endsAt?: number | null }
export type MyStatus = Omit<PresenceMeta, 'userId'>;
export type PartnerPresence =
  | { state: 'offline' }
  | { state: 'online' }
  | { state: 'studying'; subject: string | null; endsAt: number | null };

/** The partner's status from a channel's presence state (one entry per open tab); studying wins over online. */
export function partnerPresence(state: Record<string, PresenceMeta[]>, partnerId: string | null | undefined): PartnerPresence {
  if (!partnerId) return { state: 'offline' };
  const metas = Object.values(state).flat().filter((m) => m.userId === partnerId);
  if (metas.length === 0) return { state: 'offline' };
  const studying = metas.find((m) => m.status === 'studying');
  return studying ? { state: 'studying', subject: studying.subject ?? null, endsAt: studying.endsAt ?? null } : { state: 'online' };
}

/** "Online", "Studying Biology · 12 min left", "Studying" — or null when offline. */
export function presenceLabel(p: PartnerPresence, now: number): string | null {
  if (p.state === 'offline') return null;
  if (p.state === 'online') return 'Online';
  const what = p.subject ? `Studying ${p.subject}` : 'Studying';
  if (p.endsAt === null) return what;
  return `${what} · ${Math.max(0, Math.ceil((p.endsAt - now) / 60_000))} min left`;
}

/** Reconnect delay: 1 s, 2 s, 4 s … capped at 30 s. */
export const backoffMs = (attempt: number) => Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
