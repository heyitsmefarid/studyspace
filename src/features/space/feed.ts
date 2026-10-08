export interface FeedItem { kind: string; user_id: string; at: string; ref_id: string | null; title: string; detail: unknown }

export function describeFeedItem(item: FeedItem, who: string): { text: string; href: string | null } {
  const d = (item.detail ?? {}) as { minutes?: number; together?: boolean; accuracy?: number };
  switch (item.kind) {
    case 'session': return { text: `${who} studied ${item.title} for ${d.minutes ?? 0} min${d.together ? ' together ✦' : ''}`, href: null };
    case 'quiz': return { text: `${who} finished a quiz · ${Math.round((d.accuracy ?? 0) * 100)}%`, href: null };
    case 'achievement': return { text: `${who} unlocked ${item.title}`, href: null };
    case 'shared_note': return { text: `${who} shared “${item.title}”`, href: `/notes/${item.ref_id}` };
    case 'shared_deck': return { text: `${who} shared the deck “${item.title}”`, href: `/decks/${item.ref_id}` };
    default: return { text: `${who} was busy in the sky`, href: null };
  }
}
