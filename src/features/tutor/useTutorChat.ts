import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { friendlyMessage } from '@/lib/errors';
import { askTutor } from '@/services/ai/aiService';
import { MAX_HISTORY, type CONTEXT_TYPES, type Difficulty, type TutorMode } from '@/services/ai/schemas';
import type { AiError, AiMeta } from '@/services/ai/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { insertMessage, touchConversation, tutorKeys, useConversation, type AiMessageRow, type Conversation, type ConversationData } from './api';

export interface ChatOptions {
  mode: TutorMode; difficulty: Difficulty; fast: boolean;
  context: { type: (typeof CONTEXT_TYPES)[number]; title: string; text: string } | null;
}

const NEW = 'new';
const networkFailure = (convId: string, e: unknown) => ({ convId, error: { code: 'NETWORK', message: friendlyMessage(e), retryable: true } as AiError });

/**
 * Messages live in the React Query cache (keyed by conversation), so switching chats or creating one mid-send
 * never loses a reply. `pending`/`failure` remember which conversation they belong to.
 */
export function useTutorChat(conversationId: string | undefined, opts: ChatOptions & {
  create: (firstMessage: string) => Promise<Conversation>;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const conv = useConversation(conversationId);
  const messages = useMemo(() => conv.data?.messages ?? [], [conv.data]);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ convId: string; error: AiError } | null>(null);
  const [lastMeta, setLastMeta] = useState<{ convId: string; meta: AiMeta } | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const append = useCallback((convId: string, msg: AiMessageRow) => {
    qc.setQueryData<ConversationData>(tutorKeys.detail(convId), (d) => (d ? { ...d, messages: [...d.messages, msg] } : d));
  }, [qc]);

  const ask = useCallback(async (convId: string, history: AiMessageRow[]) => {
    setPending(convId);
    setFailure(null);
    try {
      const o = optsRef.current;
      const r = await askTutor({
        mode: o.mode, difficulty: o.difficulty, fast: o.fast,
        messages: history.slice(-MAX_HISTORY).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 8000) })),
        ...(o.context ? { context: { type: o.context.type, title: o.context.title.slice(0, 200), text: o.context.text } } : {}),
      });
      if (!r.ok) { setFailure({ convId, error: r.error }); return; }
      const saved = await insertMessage({
        conversation_id: convId, user_id: user!.id, role: 'assistant', content: r.data.text.slice(0, 20000),
        provider: r.meta.provider, model: r.meta.model, fell_back: r.meta.fellBack,
      });
      append(convId, saved);
      setLastMeta({ convId, meta: r.meta });
      await touchConversation(convId);
      void qc.invalidateQueries({ queryKey: tutorKeys.list });
    } catch (e) {
      setFailure(networkFailure(convId, e));
    } finally {
      setPending(null);
    }
  }, [append, qc, user]);

  /** Resolves true once the student's message is saved (the reply may still fail and be retried). */
  const send = useCallback(async (text: string): Promise<boolean> => {
    const content = text.trim().slice(0, 8000);
    if (!content || pending) return false;
    let saved = false;
    let convId = conversationId;
    setPending(convId ?? NEW);
    setFailure(null);
    try {
      let history = messages;
      if (!convId) {
        const created = await optsRef.current.create(content);
        convId = created.id;
        history = [];
        setPending(convId);
        optsRef.current.onCreated(convId);
      }
      const userMsg = await insertMessage({ conversation_id: convId, user_id: user!.id, role: 'user', content });
      append(convId, userMsg);
      saved = true;
      await ask(convId, [...history, userMsg]);
    } catch (e) {
      setFailure(networkFailure(convId ?? NEW, e));
      setPending(null);
    }
    return saved;
  }, [append, ask, conversationId, messages, pending, user]);

  const retry = useCallback(() => {
    if (conversationId && messages.at(-1)?.role === 'user') void ask(conversationId, messages);
  }, [ask, conversationId, messages]);

  const here = conversationId ?? NEW;
  return {
    messages,
    loading: Boolean(conversationId) && conv.isPending,
    missing: Boolean(conversationId) && conv.isError,
    conversation: conv.data?.conversation ?? null,
    sending: pending === here,
    busy: pending !== null,
    error: failure?.convId === here ? failure.error : null,
    canRetry: messages.at(-1)?.role === 'user',
    remainingToday: lastMeta?.convId === here ? lastMeta.meta.remainingToday : undefined,
    send,
    retry,
  };
}
