-- supabase/migrations/20261006000012_integrity_followups.sql
-- Phase 1 review follow-ups:
--  1. a quiz attempt's topic_breakdown is derived by the server from the graded answers (it fed weak-topic stats
--     and Nova's recommendations straight from the client before);
--  2. study sessions cannot claim `together` (it unlocks Binary Star) until shared study rooms exist;
--  3. a flashcard's owner can't be reassigned by an update.

-- 1. per-topic tally of graded answers: [{topic, correct}] → {"<topic>": {correct, total, accuracy}}
create or replace function private.topic_breakdown(p_marks jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(t.topic, jsonb_build_object(
    'correct', t.correct, 'total', t.total, 'accuracy', round(t.correct::numeric / t.total, 4))), '{}'::jsonb)
  from (
    select coalesce(nullif(btrim(e.m ->> 'topic'), ''), 'General') as topic,
           count(*) filter (where coalesce((e.m ->> 'correct')::boolean, false)) as correct,
           count(*) as total
    from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) as e(m)
    group by 1
  ) t;
$$;
revoke execute on function private.topic_breakdown(jsonb) from authenticated, anon, public;

create or replace function private.on_quiz_attempt_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb; v_qid text; v_expected text; v_topic text; v_chosen text; v_ok boolean;
  v_answers jsonb := '[]'::jsonb; v_marks jsonb := '[]'::jsonb; v_score integer := 0;
begin
  if jsonb_typeof(new.answers) <> 'array' then
    raise exception 'Answers must be a list.' using errcode = '23514';
  end if;
  for v_item in select value from jsonb_array_elements(new.answers) loop
    v_qid := v_item ->> 'questionId';
    if v_qid is null or v_qid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Unknown quiz question.' using errcode = '23514';
    end if;
    select q.correct_answer, q.topic into v_expected, v_topic
      from public.quiz_questions q where q.id = v_qid::uuid and private.can_view_quiz(q.quiz_id);
    if not found then
      select case when f.type = 'qa' then f.back else f.correct_answer end, f.topic into v_expected, v_topic
        from public.flashcards f where f.id = v_qid::uuid and private.can_view_deck(f.deck_id);
      if not found then
        raise exception 'Unknown quiz question.' using errcode = '23514';
      end if;
    end if;
    v_chosen := v_item ->> 'chosen';
    v_ok := v_chosen is not null and lower(btrim(v_chosen)) = lower(btrim(coalesce(v_expected, '')));
    if v_ok then v_score := v_score + 1; end if;
    v_answers := v_answers || jsonb_build_array(jsonb_set(v_item, '{correct}', to_jsonb(v_ok)));
    v_marks := v_marks || jsonb_build_array(jsonb_build_object('topic', v_topic, 'correct', v_ok));
  end loop;
  new.answers := v_answers;
  new.total := jsonb_array_length(v_answers);
  new.score := v_score;
  new.topic_breakdown := private.topic_breakdown(v_marks);
  if new.total > 0 and new.duration_seconds < new.total then
    raise exception 'Quiz finished too quickly to count.' using errcode = '23514';
  end if;
  if new.finished_at is not null and new.finished_at > now() + interval '5 minutes' then
    raise exception 'Quiz attempts cannot finish in the future.' using errcode = '23514';
  end if;
  new.accuracy := case when new.total > 0 then round(new.score::numeric / new.total, 4) else 0 end;
  return new;
end $$;

-- 2. `together` is reserved for shared study rooms (Phase 2 sets it from room membership)
create or replace function private.on_study_session_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.xp_earned := case when new.focus_seconds >= 60 then private.xp_amount('study_session') else 0 end;
  new.together := false;
  return new;
end $$;

-- 3. a card stays with the member who owns its deck
alter policy flashcards_update on public.flashcards
  using (private.owns_deck(deck_id))
  with check (owner_id = (select auth.uid()) and private.owns_deck(deck_id));

revoke execute on function private.on_quiz_attempt_guard(), private.on_study_session_before()
from authenticated, anon, public;
