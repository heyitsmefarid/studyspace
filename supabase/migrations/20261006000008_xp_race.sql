-- supabase/migrations/20261006000008_xp_race.sql
-- Security review follow-up (race on the XP cap / session overlap): serialize per member by locking their
-- profile row before counting, so concurrent inserts cannot both slip under a limit.

create or replace function private.award_xp(p_user uuid, p_reason text, p_ref text, p_amount integer default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_amount integer := coalesce(p_amount, private.xp_amount(p_reason)); v_id uuid; v_cap integer;
begin
  if v_amount is null or v_amount <= 0 then return 0; end if;
  perform 1 from public.profiles where id = p_user for update;
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
  perform 1 from public.profiles where id = new.user_id for update;
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

revoke execute on function private.award_xp(uuid, text, text, integer), private.on_study_session_guard()
from authenticated, anon, public;
