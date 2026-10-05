-- supabase/migrations/20261006000007_xp_limits.sql
-- Security review follow-up (XP forgery): members can only write their own study facts, so make farming
-- their own XP impractical rather than impossible:
--  * rolling-24h caps per XP reason (achievements are one-off and uncapped);
--  * study sessions must be saved within a day of ending and may not overlap the member's other sessions;
--  * review events use server time and reject the same card re-reviewed within 2 seconds;
--  * quiz attempts are graded server-side, need at least 1 second per question and cannot finish in the future;
--    members can only update the ai_analysis column afterwards.
-- Self-reported focus time remains trusted within these limits (no server-tracked timer) — a deliberate trade-off
-- for a private two-member app.

create or replace function private.xp_daily_cap(p_reason text) returns integer
language sql immutable set search_path = '' as $$
  select case p_reason
    when 'study_session' then 24 when 'flashcard_session' then 20
    when 'quiz_completed' then 20 when 'task_completed' then 30 end;
$$;

create or replace function private.award_xp(p_user uuid, p_reason text, p_ref text, p_amount integer default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_amount integer := coalesce(p_amount, private.xp_amount(p_reason)); v_id uuid; v_cap integer;
begin
  if v_amount is null or v_amount <= 0 then return 0; end if;
  v_cap := private.xp_daily_cap(p_reason);
  if v_cap is not null and (
    select count(*) from public.xp_events
    where user_id = p_user and reason = p_reason and created_at > now() - interval '24 hours'
  ) >= v_cap then
    return 0;
  end if;
  insert into public.xp_events (user_id, amount, reason, ref) values (p_user, v_amount, p_reason, coalesce(p_ref, ''))
  on conflict (user_id, reason, ref) do nothing returning id into v_id;
  if v_id is null then return 0; end if;
  update public.profiles set xp = xp + v_amount where id = p_user;
  return v_amount;
end $$;

create or replace function private.on_study_session_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ended_at > now() + interval '5 minutes' then
    raise exception 'Study sessions cannot end in the future.' using errcode = '23514';
  end if;
  if new.ended_at < now() - interval '1 day' then
    raise exception 'Study sessions must be saved within a day of finishing.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.study_sessions s
    where s.user_id = new.user_id
      and tstzrange(s.started_at, s.ended_at, '[)') && tstzrange(new.started_at, new.ended_at, '[)')
  ) then
    raise exception 'This session overlaps another of your sessions.' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function private.on_review_event_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.reviewed_at := now();
  if exists (
    select 1 from public.review_events r
    where r.user_id = new.user_id and r.card_id = new.card_id and r.reviewed_at > now() - interval '2 seconds'
  ) then
    raise exception 'That card was just reviewed.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger review_event_guard before insert on public.review_events
  for each row execute function private.on_review_event_guard();

-- Quiz attempts are graded by the server: every answer must name a quiz question or flashcard the member can
-- see, its `correct` flag is recomputed from that source, and score/total/accuracy are derived from it.
create or replace function private.on_quiz_attempt_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb; v_qid text; v_expected text; v_chosen text; v_ok boolean;
  v_answers jsonb := '[]'::jsonb; v_score integer := 0;
begin
  if jsonb_typeof(new.answers) <> 'array' then
    raise exception 'Answers must be a list.' using errcode = '23514';
  end if;
  for v_item in select value from jsonb_array_elements(new.answers) loop
    v_qid := v_item ->> 'questionId';
    if v_qid is null or v_qid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Unknown quiz question.' using errcode = '23514';
    end if;
    select q.correct_answer into v_expected
      from public.quiz_questions q where q.id = v_qid::uuid and private.can_view_quiz(q.quiz_id);
    if not found then
      select case when f.type = 'qa' then f.back else f.correct_answer end into v_expected
        from public.flashcards f where f.id = v_qid::uuid and private.can_view_deck(f.deck_id);
      if not found then
        raise exception 'Unknown quiz question.' using errcode = '23514';
      end if;
    end if;
    v_chosen := v_item ->> 'chosen';
    v_ok := v_chosen is not null and lower(btrim(v_chosen)) = lower(btrim(coalesce(v_expected, '')));
    if v_ok then v_score := v_score + 1; end if;
    v_answers := v_answers || jsonb_build_array(jsonb_set(v_item, '{correct}', to_jsonb(v_ok)));
  end loop;
  new.answers := v_answers;
  new.total := jsonb_array_length(v_answers);
  new.score := v_score;
  if new.total > 0 and new.duration_seconds < new.total then
    raise exception 'Quiz finished too quickly to count.' using errcode = '23514';
  end if;
  if new.finished_at is not null and new.finished_at > now() + interval '5 minutes' then
    raise exception 'Quiz attempts cannot finish in the future.' using errcode = '23514';
  end if;
  new.accuracy := case when new.total > 0 then round(new.score::numeric / new.total, 4) else 0 end;
  return new;
end $$;

-- members may only attach Nova's analysis to their attempts; everything else is fixed at insert
revoke update on public.quiz_attempts from authenticated;
grant update (ai_analysis) on public.quiz_attempts to authenticated;

revoke execute on function
  private.xp_daily_cap(text),
  private.award_xp(uuid, text, text, integer),
  private.on_study_session_guard(),
  private.on_review_event_guard(),
  private.on_quiz_attempt_guard()
from authenticated, anon, public;
