-- supabase/migrations/20261006000006_integrity.sql
-- Security review follow-up (auth + XP/achievement forgery):
--  1. internal XP / streak / achievement / notification functions are callable only by triggers, never by users;
--  2. an account cannot switch to an email that is not on the allowlist;
--  3. the facts XP is derived from must be plausible: study sessions can't claim more focus than wall-clock time
--     (max 16 h, not in the future), quiz attempts must score their own recorded answers, and timezones must be real.

-- 1. lock internals (trigger functions don't need EXECUTE for the invoking role)
alter function private.on_study_session_before() security definer;
revoke execute on function
  private.xp_amount(text),
  private.award_xp(uuid, text, text, integer),
  private.revoke_xp(uuid, text, text),
  private.notify(uuid, text, text, text, text, text),
  private.unlock(uuid, text),
  private.check_achievements(uuid),
  private.touch_streak(uuid),
  private.on_study_session_before(),
  private.on_study_session_after(),
  private.on_review_event(),
  private.on_quiz_attempt(),
  private.on_task_completion(),
  private.guard_signup(),
  private.handle_new_user()
from authenticated, anon, public;

-- 2. allowlist also applies to email changes
create or replace function private.guard_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email
     and not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'StudySpace is private — that email is not on the guest list.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function private.guard_email_change() from authenticated, anon, public;
create trigger guard_email_change before update of email on auth.users
  for each row execute function private.guard_email_change();

-- 3a. plausible study sessions
alter table public.study_sessions
  add constraint study_sessions_focus_plausible
    check (focus_seconds <= extract(epoch from (ended_at - started_at)) + 5),
  add constraint study_sessions_length_plausible
    check (ended_at - started_at <= interval '16 hours');

create or replace function private.on_study_session_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ended_at > now() + interval '5 minutes' then
    raise exception 'Study sessions cannot end in the future.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function private.on_study_session_guard() from authenticated, anon, public;
create trigger study_session_guard before insert on public.study_sessions
  for each row execute function private.on_study_session_guard();

-- 3b. quiz attempts score their own answers
alter table public.quiz_attempts
  add constraint quiz_attempts_total_matches_answers
    check (jsonb_typeof(answers) = 'array' and total = jsonb_array_length(answers) and total <= 200);

create or replace function private.on_quiz_attempt_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_correct integer;
begin
  select count(*) into v_correct from jsonb_array_elements(new.answers) a where (a ->> 'correct')::boolean is true;
  if new.score <> v_correct then
    raise exception 'Quiz score does not match the recorded answers.' using errcode = '23514';
  end if;
  new.accuracy := case when new.total > 0 then round(new.score::numeric / new.total, 4) else 0 end;
  return new;
end $$;
revoke execute on function private.on_quiz_attempt_guard() from authenticated, anon, public;
create trigger quiz_attempt_guard before insert or update of score, total, answers on public.quiz_attempts
  for each row execute function private.on_quiz_attempt_guard();

-- 3c. timezones must be real (streak days and daily AI limits are computed in this zone)
create or replace function private.on_profile_timezone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function private.on_profile_timezone() from authenticated, anon, public;
create trigger profile_timezone_guard before insert or update of timezone on public.profiles
  for each row execute function private.on_profile_timezone();
