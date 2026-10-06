import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables, type TablesInsert, type TablesUpdate } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';

export type Conversation = Tables<'ai_conversations'>;
export type AiMessageRow = Tables<'ai_messages'>;
export interface ConversationData { conversation: Conversation; messages: AiMessageRow[] }

export const tutorKeys = {
  all: ['tutor'] as const,
  list: ['tutor', 'list'] as const,
  detail: (id: string) => ['tutor', 'detail', id] as const,
};

export function useConversations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: tutorKeys.list,
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('ai_conversations').select('*').eq('user_id', user!.id)
      .order('updated_at', { ascending: false }).limit(100)),
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: tutorKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<ConversationData> => {
      const conversation = unwrap(await supabase.from('ai_conversations').select('*').eq('id', id!).single());
      const messages = unwrap(await supabase.from('ai_messages').select('*').eq('conversation_id', id!).order('created_at').limit(500));
      return { conversation, messages };
    },
  });
}

type NewConversation = Pick<TablesInsert<'ai_conversations'>, 'title' | 'mode' | 'difficulty' | 'context_type' | 'context_id' | 'context_title'>;

export function useCreateConversation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: NewConversation) =>
      unwrap(await supabase.from('ai_conversations').insert({ ...input, user_id: user!.id }).select().single()),
    onSuccess: (row) => {
      qc.setQueryData<ConversationData>(tutorKeys.detail(row.id), { conversation: row, messages: [] });
      void qc.invalidateQueries({ queryKey: tutorKeys.list });
    },
  });
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) =>
      assertOk(await supabase.from('ai_conversations').update({ title: title.trim().slice(0, 120) || 'New conversation' }).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: tutorKeys.all }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('ai_conversations').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: tutorKeys.list }),
  });
}

export async function insertMessage(row: TablesInsert<'ai_messages'>): Promise<AiMessageRow> {
  return unwrap(await supabase.from('ai_messages').insert(row).select().single());
}

export async function touchConversation(id: string, patch: Pick<TablesUpdate<'ai_conversations'>, 'mode' | 'difficulty' | 'title'> = {}) {
  assertOk(await supabase.from('ai_conversations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id));
}
