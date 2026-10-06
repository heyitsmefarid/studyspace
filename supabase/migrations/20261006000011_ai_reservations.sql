-- supabase/migrations/20261006000011_ai_reservations.sql
-- Security review follow-up (AI rate-limit bypass): the Edge Function reserves a request slot atomically
-- before calling any provider. A per-member advisory lock serialises concurrent requests, and the daily
-- window is a rolling 24 hours (not local midnight, which a member could shift by changing timezone).
-- The reserved row starts as status 'error' / error_code 'IN_PROGRESS' and is finalised after the call.

create or replace function public.reserve_ai_request(p_user uuid, p_task text, p_per_minute integer, p_per_day integer)
returns table (allowed boolean, request_id uuid, used_today integer, code text)
language plpgsql security definer set search_path = '' as $$
declare v_minute integer; v_day integer; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai:' || p_user::text));
  select count(*) filter (where created_at > now() - interval '1 minute'),
         count(*) filter (where created_at > now() - interval '24 hours')
    into v_minute, v_day
    from public.ai_requests where user_id = p_user and created_at > now() - interval '24 hours';
  if v_day >= p_per_day then
    return query select false, null::uuid, v_day, 'DAILY_LIMIT'::text; return;
  end if;
  if v_minute >= p_per_minute then
    return query select false, null::uuid, v_day, 'RATE_LIMITED'::text; return;
  end if;
  insert into public.ai_requests (user_id, task, status, error_code) values (p_user, p_task, 'error', 'IN_PROGRESS')
  returning id into v_id;
  return query select true, v_id, v_day + 1, null::text;
end $$;

revoke execute on function public.reserve_ai_request(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, text, integer, integer) to service_role;
