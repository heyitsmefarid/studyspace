import { useQuery } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import type { TimerMode } from './timer';

export type StudySession = Tables<'study_sessions'>;

export async function saveStudySession(i: { subjectId: string | null; taskId: string | null; mode: TimerMode; startedAt: string; endedAt: string; focusSeconds: number; cardsStudied: number; questionsAnswered: number; correctAnswers: number }) {
  const { data: { user } } = await supabase.auth.getUser();
  return unwrap(await supabase.from('study_sessions').insert({
    user_id: user!.id, subject_id: i.subjectId, task_id: i.taskId, mode: i.mode, started_at: i.startedAt, ended_at: i.endedAt,
    focus_seconds: i.focusSeconds, cards_studied: i.cardsStudied, questions_answered: i.questionsAnswered, correct_answers: i.correctAnswers,
  }).select().single());
}

export function useSessions(sinceIso: string, userId?: string) {
  const { user } = useAuth();
  const uid = userId ?? user?.id;
  return useQuery({
    queryKey: ['sessions', uid, sinceIso],
    enabled: Boolean(uid),
    queryFn: async () => unwrap(await supabase.from('study_sessions')
      .select('id, started_at, ended_at, focus_seconds, subject_id, together, cards_studied, questions_answered, correct_answers')
      .eq('user_id', uid!).gte('started_at', sinceIso).order('started_at', { ascending: false })),
  });
}
