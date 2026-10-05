-- supabase/migrations/20261006000005_gamification.sql
insert into public.achievements (code, name, description, icon, xp_reward, sort) values
  ('first_light',     'First Light',   'Finish your first study session.',              'sparkle',   25, 1),
  ('meteor_shower',   'Meteor Shower', 'Review 100 flashcards.',                         'zap',       50, 2),
  ('star_cluster',    'Star Cluster',  'Review 500 flashcards.',                         'stars',    100, 3),
  ('seven_day_orbit', '7-Day Orbit',   'Study 7 days in a row.',                         'orbit',     50, 4),
  ('full_moon',       'Full Moon',     'Study 30 days in a row.',                        'moon',     150, 5),
  ('supernova',       'Supernova',     'Score 100% on a quiz with at least 5 questions.','sun',       50, 6),
  ('light_year',      'Light-Year',    'Reach 10 hours of focused study.',               'telescope',100, 7),
  ('quiz_master',     'Quiz Master',   'Finish 10 quizzes at 80% or higher.',            'trophy',   100, 8),
  ('long_night',      'Long Night',    'Focus for 2 hours in a single session.',         'moon-star', 75, 9),
  ('binary_star',     'Binary Star',   'Finish a study session together.',               'heart',     50, 10)
on conflict (code) do nothing;

create or replace function private.xp_amount(p_reason text) returns integer
language sql immutable set search_path = '' as $$
  select case p_reason
    when 'study_session' then 10 when 'flashcard_session' then 10
    when 'quiz_completed' then 20 when 'task_completed' then 5 else 0 end;
$$;

create or replace function private.award_xp(p_user uuid, p_reason text, p_ref text, p_amount integer default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_amount integer := coalesce(p_amount, private.xp_amount(p_reason)); v_id uuid;
begin
  if v_amount is null or v_amount <= 0 then return 0; end if;
  insert into public.xp_events (user_id, amount, reason, ref) values (p_user, v_amount, p_reason, coalesce(p_ref, ''))
  on conflict (user_id, reason, ref) do nothing returning id into v_id;
  if v_id is null then return 0; end if;
  update public.profiles set xp = xp + v_amount where id = p_user;
  return v_amount;
end $$;

create or replace function private.revoke_xp(p_user uuid, p_reason text, p_ref text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_amount integer;
begin
  delete from public.xp_events where user_id = p_user and reason = p_reason and ref = p_ref returning amount into v_amount;
  if v_amount is not null then
    update public.profiles set xp = greatest(0, xp - v_amount) where id = p_user;
  end if;
end $$;

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, p_kind, p_title, coalesce(p_body, ''), p_link, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
$$;

create or replace function private.unlock(p_user uuid, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_desc text; v_xp integer; v_inserted boolean;
begin
  insert into public.user_achievements (user_id, achievement_code) values (p_user, p_code)
  on conflict do nothing returning true into v_inserted;
  if not coalesce(v_inserted, false) then return; end if;
  select name, description, xp_reward into v_name, v_desc, v_xp from public.achievements where code = p_code;
  perform private.award_xp(p_user, 'achievement', p_code, v_xp);
  perform private.notify(p_user, 'achievement', 'Achievement unlocked: ' || v_name, v_desc, '/profile', 'ach:' || p_code);
end $$;

create or replace function private.check_achievements(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sessions integer; v_focus bigint; v_long boolean; v_together boolean;
  v_reviews integer; v_longest integer; v_perfect boolean; v_good integer;
begin
  select count(*), coalesce(sum(focus_seconds), 0), coalesce(bool_or(focus_seconds >= 7200), false), coalesce(bool_or(together), false)
    into v_sessions, v_focus, v_long, v_together from public.study_sessions where user_id = p_user;
  select count(*) into v_reviews from public.review_events where user_id = p_user;
  select longest_streak into v_longest from public.profiles where id = p_user;
  select coalesce(bool_or(score = total and total >= 5), false), count(*) filter (where accuracy >= 0.8)
    into v_perfect, v_good from public.quiz_attempts where user_id = p_user and finished_at is not null;

  if v_sessions >= 1 then perform private.unlock(p_user, 'first_light'); end if;
  if v_reviews >= 100 then perform private.unlock(p_user, 'meteor_shower'); end if;
  if v_reviews >= 500 then perform private.unlock(p_user, 'star_cluster'); end if;
  if v_longest >= 7 then perform private.unlock(p_user, 'seven_day_orbit'); end if;
  if v_longest >= 30 then perform private.unlock(p_user, 'full_moon'); end if;
  if v_perfect then perform private.unlock(p_user, 'supernova'); end if;
  if v_focus >= 36000 then perform private.unlock(p_user, 'light_year'); end if;
  if v_good >= 10 then perform private.unlock(p_user, 'quiz_master'); end if;
  if v_long then perform private.unlock(p_user, 'long_night'); end if;
  if v_together then perform private.unlock(p_user, 'binary_star'); end if;
end $$;

create or replace function private.touch_streak(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tz text; v_last date; v_cur integer; v_today date; v_name text; v_partner uuid;
begin
  select timezone, last_active_date, current_streak, display_name into v_tz, v_last, v_cur, v_name
    from public.profiles where id = p_user for update;
  begin
    v_today := (now() at time zone v_tz)::date;
  exception when others then
    v_today := (now() at time zone 'Asia/Manila')::date;
  end;
  if v_last = v_today then return; end if;
  v_cur := case when v_last = v_today - 1 then v_cur + 1 else 1 end;
  update public.profiles
     set current_streak = v_cur, longest_streak = greatest(longest_streak, v_cur), last_active_date = v_today
   where id = p_user;
  if v_cur in (3, 7, 14, 30, 50, 100) then
    perform private.notify(p_user, 'streak', v_cur || '-day orbit!', 'Your comet tail keeps growing. ✦', '/', 'streak:' || v_cur || ':' || v_today);
    select id into v_partner from public.profiles where id <> p_user limit 1;
    if v_partner is not null then
      perform private.notify(v_partner, 'streak', v_name || ' hit a ' || v_cur || '-day orbit', 'Send a shooting star?', '/space', 'pstreak:' || p_user || ':' || v_cur || ':' || v_today);
    end if;
  end if;
end $$;

-- study_sessions: fix xp_earned, then award + streak + achievements
create or replace function private.on_study_session_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.xp_earned := case when new.focus_seconds >= 60 then private.xp_amount('study_session') else 0 end;
  return new;
end $$;
create or replace function private.on_study_session_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.focus_seconds >= 60 then perform private.award_xp(new.user_id, 'study_session', new.id::text); end if;
  if new.focus_seconds >= 300 then perform private.touch_streak(new.user_id); end if;
  perform private.check_achievements(new.user_id);
  return null;
end $$;
create trigger study_session_before before insert on public.study_sessions for each row execute function private.on_study_session_before();
create trigger study_session_after after insert on public.study_sessions for each row execute function private.on_study_session_after();

create or replace function private.on_review_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.touch_streak(new.user_id);
  perform private.check_achievements(new.user_id);
  return null;
end $$;
create trigger review_event_after after insert on public.review_events for each row execute function private.on_review_event();

create or replace function private.on_quiz_attempt() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.finished_at is not null and (tg_op = 'INSERT' or old.finished_at is null) then
    perform private.award_xp(new.user_id, 'quiz_completed', new.id::text);
    perform private.touch_streak(new.user_id);
    perform private.check_achievements(new.user_id);
  end if;
  return null;
end $$;
create trigger quiz_attempt_after after insert or update of finished_at on public.quiz_attempts for each row execute function private.on_quiz_attempt();

create or replace function private.on_task_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.award_xp(new.user_id, 'task_completed', new.id::text);
  else
    perform private.revoke_xp(old.user_id, 'task_completed', old.id::text);
  end if;
  return null;
end $$;
create trigger task_completion_after after insert or delete on public.task_completions for each row execute function private.on_task_completion();

-- RPC: flashcard session XP (≥ 5 reviews with that session key)
create or replace function public.complete_flashcard_session(p_session_key uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if (select auth.uid()) is null then return 0; end if;
  select count(*) into v_count from public.review_events where user_id = (select auth.uid()) and session_key = p_session_key;
  if v_count < 5 then return 0; end if;
  return private.award_xp((select auth.uid()), 'flashcard_session', p_session_key::text);
end $$;
revoke execute on function public.complete_flashcard_session(uuid) from public, anon;
grant execute on function public.complete_flashcard_session(uuid) to authenticated;

-- RPC: note search (security invoker → RLS applies)
create or replace function public.search_notes(q text) returns setof public.notes
language sql stable set search_path = '' as $$
  select n.* from public.notes n
  where n.search @@ websearch_to_tsquery('simple', q) or n.title ilike '%' || q || '%'
  order by ts_rank(n.search, websearch_to_tsquery('simple', q)) desc, n.updated_at desc
  limit 50;
$$;
revoke execute on function public.search_notes(text) from public, anon;
grant execute on function public.search_notes(text) to authenticated;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
