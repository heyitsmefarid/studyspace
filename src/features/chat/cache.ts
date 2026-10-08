import type { InfiniteData } from '@tanstack/react-query';
import type { ChatMessage, Reaction } from './types';

/** Newest page first; each page newest message first. */
export type MessagePages = InfiniteData<ChatMessage[], string | null>;

/** Replaces the cached copy (optimistic → confirmed, live → deleted) or adds the message at the newest end. */
export function upsertMessage(data: MessagePages | undefined, msg: ChatMessage): MessagePages | undefined {
  if (!data) return data;
  let found = false;
  const pages = data.pages.map((page) => page.map((m) => {
    if (m.id !== msg.id) return m;
    found = true;
    return { ...msg, reactions: m.reactions };
  }));
  if (found) return { ...data, pages };
  const [first = [], ...rest] = pages;
  return { ...data, pages: [[msg, ...first], ...rest] };
}

export function dropMessage(data: MessagePages | undefined, id: string): MessagePages | undefined {
  return data && { ...data, pages: data.pages.map((page) => page.filter((m) => m.id !== id)) };
}

export function applyReaction(data: MessagePages | undefined, r: Reaction & { message_id: string }, op: 'add' | 'remove'): MessagePages | undefined {
  if (!data) return data;
  const same = (x: Reaction) => x.user_id === r.user_id && x.emoji === r.emoji;
  return {
    ...data,
    pages: data.pages.map((page) => page.map((m) => {
      if (m.id !== r.message_id) return m;
      if (op === 'add') return m.reactions.some(same) ? m : { ...m, reactions: [...m.reactions, { user_id: r.user_id, emoji: r.emoji }] };
      return { ...m, reactions: m.reactions.filter((x) => !same(x)) };
    })),
  };
}

/** Oldest-first list for rendering. */
export const flatten = (data: MessagePages | undefined): ChatMessage[] => (data ? data.pages.flat().reverse() : []);

/** Cursor for the next (older) page: the oldest message's time while the page was full; live messages prepended to the newest page can push it past PAGE. */
export const nextPageParam = (page: ChatMessage[], pageSize: number): string | undefined => (page.length >= pageSize ? page[page.length - 1]!.created_at : undefined);
