import { useQuery } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { AppError, friendlyMessage, unwrap } from '@/lib/errors';
import { fetchAll } from '@/lib/fetchAll';
import { useAuth } from '@/features/auth/AuthProvider';
import type { TimerMode } from './timer';

export type StudySession = Tables<'study_sessions'>;

/**
 * Inserts with the client-generated session id, so a retry after a lost response is recognised: the server's overlap
 * guard rejects the duplicate, and finding our own row means the first attempt already saved it.
 */
export async function saveStudySession(i: { id: string; subjectId: string | null; taskId: string | null; mode: TimerMode; startedAt: string; endedAt: string; focusSeconds: number; cardsStudied: number; questionsAnswered: number; correctAnswers: number; roomId: string | null }) {
  const { data: { user } } = await supabase.auth.getUser();
  const res = await supabase.from('study_sessions').insert({
    id: i.id, user_id: user!.id, subject_id: i.subjectId, task_id: i.taskId, mode: i.mode, started_at: i.startedAt, ended_at: i.endedAt,
    focus_seconds: i.focusSeconds, cards_studied: i.cardsStudied, questions_answered: i.questionsAnswered, correct_answers: i.correctAnswers, room_id: i.roomId,
  }).select().single();
  if (!res.error) return unwrap(res);
  const existing = await supabase.from('study_sessions').select('*').eq('id', i.id).maybeSingle();
  if (existing.data) return existing.data;
  throw new AppError(friendlyMessage(res.error), res.error.code, res.error);
}

export function useSessions(sinceIso: string, userId?: string) {
  const { user } = useAuth();
  const uid = userId ?? user?.id;
  return useQuery({
    queryKey: ['sessions', uid, sinceIso],
    enabled: Boolean(uid),
    queryFn: () => fetchAll((from, to) => supabase.from('study_sessions')
      .select('id, started_at, ended_at, focus_seconds, subject_id, together, cards_studied, questions_answered, correct_answers')
      .eq('user_id', uid!).gte('started_at', sinceIso).order('started_at', { ascending: false }).order('id').range(from, to)),
  });
}
