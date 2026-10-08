-- supabase/migrations/20261006000014_phase2_space.sql
-- Phase 2 (spec §4.4–4.6):
--  1. studying together: a session overlapping the other member's by ≥ 10 minutes marks both `together`
--     (unlocking Binary Star); `together` is never taken from the client and room_id must name a real room;
--  2. Our Space: member-only stats (counts only) and an activity feed that honours privacy.shareActivity and never
--     shows private titles;
--  3. goal progress can't go below zero.

-- 1.
create or replace function private.on_study_session_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_partner uuid;
begin
  new.xp_earned := case when new.focus_seconds >= 60 then private.xp_amount('study_session') else 0 end;
  new.together := false;
  if new.room_id is not null and not exists (select 1 from public.study_rooms where id = new.room_id) then
    new.room_id := null;
  end if;
  select id into v_partner from public.profiles where id <> new.user_id limit 1;
  if v_partner is not null and exists (
    select 1 from public.study_sessions s
    where s.user_id = v_partner
      and extract(epoch from (least(s.ended_at, new.ended_at) - greatest(s.started_at, new.started_at))) >= 600
  ) then
    new.together := true;
    update public.study_sessions s set together = true
     where s.user_id = v_partner and not s.together
       and extract(epoch from (least(s.ended_at, new.ended_at) - greatest(s.started_at, new.started_at))) >= 600;
    perform private.check_achievements(v_partner);
  end if;
  return new;
end $$;

-- 2.
create or replace function public.get_space_stats(p_week_start timestamptz)
returns table (
  user_id uuid, focus_seconds_total bigint, focus_seconds_week bigint, cards_total bigint, cards_week bigint,
  quizzes_total bigint, quizzes_week bigint, achievements bigint, current_streak integer, longest_streak integer,
  last_active_date date, together_seconds_total bigint
)
language sql stable security definer set search_path = '' as $$
  select p.id,
    coalesce((select sum(s.focus_seconds) from public.study_sessions s where s.user_id = p.id), 0)::bigint,
    coalesce((select sum(s.focus_seconds) from public.study_sessions s where s.user_id = p.id and s.started_at >= p_week_start), 0)::bigint,
    (select count(*) from public.review_events r where r.user_id = p.id),
    (select count(*) from public.review_events r where r.user_id = p.id and r.reviewed_at >= p_week_start),
    (select count(*) from public.quiz_attempts q where q.user_id = p.id and q.finished_at is not null),
    (select count(*) from public.quiz_attempts q where q.user_id = p.id and q.finished_at >= p_week_start),
    (select count(*) from public.user_achievements ua where ua.user_id = p.id),
    p.current_streak, p.longest_streak, p.last_active_date,
    coalesce((select sum(s.focus_seconds) from public.study_sessions s where s.user_id = p.id and s.together), 0)::bigint
  from public.profiles p
  where private.is_member()
  order by p.created_at;
$$;

create or replace function public.space_feed(p_limit integer default 30)
returns table (kind text, user_id uuid, at timestamptz, ref_id uuid, title text, detail jsonb)
language sql stable security definer set search_path = '' as $$
  with visible as (
    select p.id from public.profiles p
    where private.is_member()
      and (p.id = (select auth.uid()) or coalesce(p.preferences -> 'privacy' ->> 'shareActivity', 'true') <> 'false')
  ), events as (
    (select 'session'::text as kind, s.user_id, s.ended_at as at, s.id as ref_id, coalesce(sub.name, 'Study') as title,
            jsonb_build_object('minutes', round(s.focus_seconds / 60.0), 'together', s.together) as detail
       from public.study_sessions s left join public.subjects sub on sub.id = s.subject_id
      where s.user_id in (select id from visible) order by s.ended_at desc limit 100)
    union all
    (select 'quiz', q.user_id, q.finished_at, q.id, 'Quiz', jsonb_build_object('accuracy', q.accuracy)
       from public.quiz_attempts q
      where q.finished_at is not null and q.user_id in (select id from visible) order by q.finished_at desc limit 100)
    union all
    (select 'achievement', ua.user_id, ua.unlocked_at, null::uuid, a.name, jsonb_build_object('icon', a.icon, 'code', a.code)
       from public.user_achievements ua join public.achievements a on a.code = ua.achievement_code
      where ua.user_id in (select id from visible) order by ua.unlocked_at desc limit 100)
    union all
    (select 'shared_note', n.owner_id, n.updated_at, n.id, n.title, '{}'::jsonb
       from public.notes n where n.is_shared and n.owner_id in (select id from visible) order by n.updated_at desc limit 100)
    union all
    (select 'shared_deck', d.owner_id, d.updated_at, d.id, d.title, '{}'::jsonb
       from public.decks d where d.is_shared and d.owner_id in (select id from visible) order by d.updated_at desc limit 100)
  )
  select * from events order by at desc limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke execute on function public.get_space_stats(timestamptz), public.space_feed(integer) from public, anon;
grant execute on function public.get_space_stats(timestamptz), public.space_feed(integer) to authenticated;
revoke execute on function private.on_study_session_before() from authenticated, anon, public;

-- 3.
alter table public.study_goals add constraint study_goals_progress_nonneg check (progress >= 0);
