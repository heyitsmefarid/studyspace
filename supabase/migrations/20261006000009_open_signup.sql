-- supabase/migrations/20261006000009_open_signup.sql
-- Sign-up without hard-coded emails: the first account to sign up becomes member #1; member #1 invites the
-- second member by email (allowed_emails); once two members exist every further sign-up is refused.

create or replace function private.guard_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_members integer;
begin
  perform pg_advisory_xact_lock(hashtext('studyspace:signup'));
  select count(*) into v_members from public.profiles;
  if v_members >= 2 then
    raise exception 'StudySpace already has its two members.' using errcode = 'P0001';
  end if;
  if v_members = 0 then
    return new; -- the very first account
  end if;
  if new.email is null or not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'StudySpace is private — ask your partner to invite this email first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function private.guard_signup() from authenticated, anon, public;

-- Member #1 invites their partner. Only callable by a member while the second seat is free.
create or replace function public.invite_partner(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not private.is_member() then
    raise exception 'Only StudySpace members can invite.' using errcode = '42501';
  end if;
  if (select count(*) from public.profiles) >= 2 then
    raise exception 'StudySpace already has its two members.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'That does not look like an email address.' using errcode = '22023';
  end if;
  -- several invites may be pending; the two-member cap means only one more account can ever sign up
  insert into public.allowed_emails (email) values (v_email) on conflict do nothing;
end $$;
revoke execute on function public.invite_partner(text) from public, anon;
grant execute on function public.invite_partner(text) to authenticated;

-- What a member sees about the invite (never exposed to anonymous users).
create or replace function public.pending_invite() returns text
language sql stable security definer set search_path = '' as $$
  select case when private.is_member() then (select string_agg(email, ', ' order by email) from public.allowed_emails) end;
$$;
revoke execute on function public.pending_invite() from public, anon;
grant execute on function public.pending_invite() to authenticated;
