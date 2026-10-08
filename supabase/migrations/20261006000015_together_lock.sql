-- supabase/migrations/20261006000015_together_lock.sql
-- Phase 2 final-review fix: two members saving at nearly the same moment (common with the shared orbit) each ran the
-- overlap check without seeing the other's uncommitted row, so neither was marked `together`. A transaction-scoped
-- advisory lock serialises the two saves; under READ COMMITTED the second then sees the first's committed row.

create or replace function private.on_study_session_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_partner uuid;
begin
  -- serialises the two members' saves so the second sees the first's committed row (READ COMMITTED)
  perform pg_advisory_xact_lock(hashtext('ss:together'));
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

revoke execute on function private.on_study_session_before() from authenticated, anon, public;
