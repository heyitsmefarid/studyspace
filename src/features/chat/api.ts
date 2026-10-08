import { useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AppError, assertOk, friendlyMessage, unwrap } from '@/lib/errors';
import { objectPath, removeFile, safeContentType, safeFileName } from '@/lib/storage';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOurRoom } from '@/features/realtime/RealtimeProvider';
import { applyReaction, dropMessage, nextPageParam, upsertMessage, type MessagePages } from './cache';
import { escapeLike } from './rules';
import type { ChatMessage, Reaction } from './types';

export const PAGE = 50;
const COLS = 'id, room_id, sender_id, kind, body, attachment_path, attachment_name, attachment_mime, deleted_at, created_at, message_reactions(user_id, emoji)';
export const chatKeys = {
  all: ['chat'] as const,
  messages: (roomId: string) => ['chat', 'messages', roomId] as const,
  search: (q: string) => ['chat', 'search', q] as const,
};

type Row = Omit<ChatMessage, 'kind' | 'reactions' | 'pending'> & { kind: string; message_reactions?: Reaction[] | null };
export const toMessage = ({ message_reactions, ...row }: Row): ChatMessage => ({
  ...row, kind: row.kind as ChatMessage['kind'], reactions: message_reactions ?? [],
});

export function useMessages() {
  const room = useOurRoom().data;
  return useInfiniteQuery({
    queryKey: chatKeys.messages(room ?? ''),
    enabled: Boolean(room),
    staleTime: Infinity, // kept fresh by Realtime; refreshed after a reconnect
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from('messages').select(COLS).eq('room_id', room!).order('created_at', { ascending: false }).limit(PAGE);
      if (pageParam) q = q.lt('created_at', pageParam);
      return unwrap(await q).map(toMessage);
    },
    getNextPageParam: (last) => nextPageParam(last, PAGE),
  });
}

export interface Draft { kind: ChatMessage['kind']; body: string; file?: File }

async function insertMessage(id: string, roomId: string, senderId: string, d: Draft): Promise<ChatMessage> {
  let attachment = { attachment_path: null as string | null, attachment_name: null as string | null, attachment_mime: null as string | null };
  if (d.file) {
    const path = objectPath(senderId, `${id}-${safeFileName(d.file.name)}`);
    // upsert: a retry after an upload that succeeded (but whose insert failed) must not fail on "already exists"
    const { error } = await supabase.storage.from('chat-files').upload(path, d.file, { contentType: safeContentType(d.file.type), upsert: true });
    if (error) throw new AppError(/exceed|too large/i.test(error.message) ? 'That file is too large.' : friendlyMessage(error), undefined, error);
    attachment = { attachment_path: path, attachment_name: d.file.name.slice(0, 255), attachment_mime: safeContentType(d.file.type) };
  }
  const res = await supabase.from('messages').insert({ id, room_id: roomId, sender_id: senderId, kind: d.kind, body: d.body, ...attachment }).select(COLS).single();
  if (!res.error) return toMessage(res.data);
  // a lost response: the first attempt may already have saved it
  const existing = await supabase.from('messages').select(COLS).eq('id', id).maybeSingle();
  if (existing.data) return toMessage(existing.data);
  throw new AppError(friendlyMessage(res.error), res.error.code, res.error);
}

/** Unsent drafts by message id, so a failed bubble can be retried with its file. */
const drafts = new Map<string, Draft>();

/** Optimistic sending: the bubble appears at once, turns "failed" with Retry/Discard on error; text is never lost. */
export function useOutbox() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const room = useOurRoom().data;
  const put = useCallback((m: ChatMessage) => qc.setQueryData<MessagePages>(chatKeys.messages(room ?? ''), (d) => upsertMessage(d, m)), [qc, room]);

  const deliver = useCallback(async (id: string, d: Draft): Promise<ChatMessage> => {
    if (!room || !user) throw new AppError('Chat isn’t ready yet.');
    drafts.set(id, d);
    const optimistic: ChatMessage = {
      id, room_id: room, sender_id: user.id, kind: d.kind, body: d.body.trim(),
      attachment_path: null, attachment_name: d.file?.name ?? null, attachment_mime: d.file?.type ?? null,
      deleted_at: null, created_at: new Date().toISOString(), reactions: [], pending: 'sending',
    };
    put(optimistic);
    try {
      const saved = await insertMessage(id, room, user.id, d);
      drafts.delete(id);
      put(saved);
      return saved;
    } catch (e) {
      put({ ...optimistic, pending: 'failed' });
      throw e;
    }
  }, [room, user, put]);

  const send = useCallback((d: Draft) => deliver(crypto.randomUUID(), d), [deliver]);
  const retry = useCallback((id: string) => {
    const d = drafts.get(id);
    return d ? deliver(id, d) : Promise.reject(new AppError('That message can’t be retried.'));
  }, [deliver]);
  const discard = useCallback((id: string) => {
    drafts.delete(id);
    qc.setQueryData<MessagePages>(chatKeys.messages(room ?? ''), (d) => dropMessage(d, id));
  }, [qc, room]);
  return { send, retry, discard };
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  const room = useOurRoom().data;
  return useMutation({
    mutationFn: async (m: ChatMessage) => {
      if (m.attachment_path) {
        try { await removeFile('chat-files', m.attachment_path); }
        catch (e) { console.warn('Could not remove the attachment; the message is still deleted.', e); }
      }
      assertOk(await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', m.id));
    },
    onSuccess: (_r, m) => qc.setQueryData<MessagePages>(chatKeys.messages(room ?? ''), (d) => upsertMessage(d, {
      ...m, deleted_at: new Date().toISOString(), body: '', attachment_path: null, attachment_name: null, attachment_mime: null,
    })),
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const room = useOurRoom().data;
  const apply = (messageId: string, emoji: string, op: 'add' | 'remove') =>
    qc.setQueryData<MessagePages>(chatKeys.messages(room ?? ''), (d) => applyReaction(d, { message_id: messageId, user_id: user!.id, emoji }, op));
  return useMutation({
    mutationFn: async ({ messageId, emoji, mine }: { messageId: string; emoji: string; mine: boolean }) => {
      if (mine) assertOk(await supabase.from('message_reactions').delete().match({ message_id: messageId, user_id: user!.id, emoji }));
      else assertOk(await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: user!.id, emoji }, { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true }));
    },
    onMutate: ({ messageId, emoji, mine }) => apply(messageId, emoji, mine ? 'remove' : 'add'),
    onError: (_e, { messageId, emoji, mine }) => apply(messageId, emoji, mine ? 'add' : 'remove'),
  });
}

export function useMessageSearch(q: string) {
  const room = useOurRoom().data;
  const term = q.trim();
  return useQuery({
    queryKey: chatKeys.search(term),
    enabled: Boolean(room) && term.length >= 2,
    queryFn: async () => unwrap(await supabase.from('messages').select(COLS).eq('room_id', room!).is('deleted_at', null)
      .ilike('body', `%${escapeLike(term)}%`).order('created_at', { ascending: false }).limit(30)).map(toMessage),
  });
}

/** The 25 messages before and after `target`, oldest first, for jumping to a search result. */
export async function loadAround(roomId: string, target: ChatMessage): Promise<ChatMessage[]> {
  const [before, after] = await Promise.all([
    supabase.from('messages').select(COLS).eq('room_id', roomId).lt('created_at', target.created_at).order('created_at', { ascending: false }).limit(25),
    supabase.from('messages').select(COLS).eq('room_id', roomId).gt('created_at', target.created_at).order('created_at').limit(25),
  ]);
  return [...unwrap(before).map(toMessage).reverse(), target, ...unwrap(after).map(toMessage)];
}

/** Signed URL for a chat attachment; with `downloadName` the browser saves it instead of opening it. */
export function useAttachmentUrl(path: string | null, downloadName?: string) {
  return useQuery({
    queryKey: ['signed-url', 'chat-files', path, downloadName ?? ''],
    enabled: Boolean(path),
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('chat-files').createSignedUrl(path!, 3600, downloadName ? { download: downloadName } : undefined);
      if (error) throw new AppError(friendlyMessage(error));
      return data.signedUrl;
    },
  }).data;
}
