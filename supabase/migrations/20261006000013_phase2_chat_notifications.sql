-- supabase/migrations/20261006000013_phase2_chat_notifications.sql
-- Phase 2 (spec 2026-10-06-studyspace-phase-2-design §4.1–4.3):
--  1. the private room channel: only members may use broadcast/presence on `room:<study_rooms.id>`;
--  2. messages: guarded inserts (text/star/file only, no listings or system rows), delete-only updates, and no
--     reactions on deleted messages;
--  3. notifications: per-kind opt-out, message and shared-item triggers, and an idempotent reminder refresh.

-- 1. private room channel
create or replace function private.is_room_topic(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_rooms r where 'room:' || r.id::text = p_topic);
$$;
revoke execute on function private.is_room_topic(text) from public, anon;
grant execute on function private.is_room_topic(text) to authenticated;

create policy "ss room members receive" on realtime.messages for select to authenticated
  using (private.is_member() and private.is_room_topic((select realtime.topic()))
         and realtime.messages.extension in ('broadcast', 'presence'));
create policy "ss room members send" on realtime.messages for insert to authenticated
  with check (private.is_member() and private.is_room_topic((select realtime.topic()))
              and realtime.messages.extension in ('broadcast', 'presence'));

-- 2a. guarded inserts
create or replace function private.on_message_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind not in ('text', 'star', 'file') then
    raise exception 'That kind of message can''t be sent.' using errcode = '23514';
  end if;
  new.body := btrim(coalesce(new.body, ''));
  if new.kind = 'text' and char_length(new.body) not between 1 and 4000 then
    raise exception 'Messages need 1 to 4000 characters.' using errcode = '23514';
  end if;
  if new.kind = 'star' and char_length(new.body) not between 1 and 140 then
    raise exception 'A shooting star carries 1 to 140 characters.' using errcode = '23514';
  end if;
  if new.kind = 'file' then
    if new.attachment_path is null or split_part(new.attachment_path, '/', 1) <> new.sender_id::text then
      raise exception 'Attach a file from your own folder.' using errcode = '23514';
    end if;
    if char_length(coalesce(new.attachment_name, '')) not between 1 and 255 or coalesce(new.attachment_mime, '') = '' then
      raise exception 'The attachment needs a name and a type.' using errcode = '23514';
    end if;
  else
    new.attachment_path := null;
    new.attachment_name := null;
    new.attachment_mime := null;
  end if;
  new.created_at := now();
  new.deleted_at := null;
  new.listing_id := null;
  return new;
end $$;
create trigger message_before_insert before insert on public.messages
  for each row execute function private.on_message_before_insert();

-- 2b. delete-only updates (column grants already limit clients to deleted_at, migration 0002)
create or replace function private.on_message_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.deleted_at is not null then
    raise exception 'That message was already deleted.' using errcode = '23514';
  end if;
  new := old;
  new.deleted_at := now();
  new.body := '';
  new.attachment_path := null;
  new.attachment_name := null;
  new.attachment_mime := null;
  return new;
end $$;
create trigger message_before_update before update on public.messages
  for each row execute function private.on_message_before_update();

-- 2c. no reactions on deleted messages
create or replace function private.message_is_live(p_message uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.messages where id = p_message and deleted_at is null);
$$;
revoke execute on function private.message_is_live(uuid) from public, anon;
grant execute on function private.message_is_live(uuid) to authenticated;
alter policy message_reactions_insert on public.message_reactions
  with check (user_id = (select auth.uid()) and private.is_member() and private.message_is_live(message_id));

-- 3a. per-kind opt-out: preferences.notifications.kinds.<kind> = false skips the insert
create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select p_user, p_kind, p_title, coalesce(p_body, ''), p_link, p_dedupe
  where coalesce((select preferences -> 'notifications' -> 'kinds' ->> p_kind from public.profiles where id = p_user), 'true') <> 'false'
  on conflict (user_id, dedupe_key) do nothing;
$$;

-- 3b. messages → partner
create or replace function private.on_message_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_partner uuid; v_name text;
begin
  select id into v_partner from public.profiles where id <> new.sender_id limit 1;
  if v_partner is null then return null; end if;
  select coalesce(nullif(display_name, ''), 'Your partner') into v_name from public.profiles where id = new.sender_id;
  if new.kind = 'star' then
    perform private.notify(v_partner, 'message', v_name || ' sent you a shooting star ✦', new.body, '/chat', 'star:' || new.id);
  else
    perform private.notify(v_partner, 'message', v_name || ' sent a message',
      case when new.kind = 'file' then '📎 ' || new.attachment_name else left(new.body, 80) end,
      '/chat', 'chat:' || new.room_id || ':' || floor(extract(epoch from new.created_at) / 600)::bigint);
  end if;
  return null;
end $$;
create trigger message_after_insert after insert on public.messages
  for each row execute function private.on_message_after_insert();

-- 3c. shared notes / decks → partner (new, newly shared, or title/content changed; at most hourly per item)
create or replace function private.on_note_shared() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_partner uuid; v_name text; v_fresh boolean;
begin
  if not new.is_shared then return null; end if;
  v_fresh := tg_op = 'INSERT' or not old.is_shared;
  if not v_fresh and new.title is not distinct from old.title and new.content_text is not distinct from old.content_text then
    return null;
  end if;
  select id into v_partner from public.profiles where id <> new.owner_id limit 1;
  if v_partner is null then return null; end if;
  select coalesce(nullif(display_name, ''), 'Your partner') into v_name from public.profiles where id = new.owner_id;
  perform private.notify(v_partner, 'shared_note',
    v_name || case when v_fresh then ' shared a note' else ' updated a shared note' end, new.title, '/notes/' || new.id,
    'shared_note:' || new.id || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'));
  return null;
end $$;
create trigger note_shared_after after insert or update on public.notes
  for each row execute function private.on_note_shared();

create or replace function private.on_deck_shared() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_partner uuid; v_name text; v_fresh boolean;
begin
  if not new.is_shared then return null; end if;
  v_fresh := tg_op = 'INSERT' or not old.is_shared;
  if not v_fresh and new.title is not distinct from old.title and new.description is not distinct from old.description then
    return null;
  end if;
  select id into v_partner from public.profiles where id <> new.owner_id limit 1;
  if v_partner is null then return null; end if;
  select coalesce(nullif(display_name, ''), 'Your partner') into v_name from public.profiles where id = new.owner_id;
  perform private.notify(v_partner, 'shared_deck',
    v_name || case when v_fresh then ' shared a deck' else ' updated a shared deck' end, new.title, '/decks/' || new.id,
    'shared_deck:' || new.id || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'));
  return null;
end $$;
create trigger deck_shared_after after insert or update on public.decks
  for each row execute function private.on_deck_shared();

-- 3d. reminders for the caller (idempotent through dedupe keys); the client calls it on load and hourly on focus
create or replace function public.refresh_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_tz text; v_prefs jsonb; v_last date; v_local timestamp; v_today date; v_start integer; t record;
begin
  if v_uid is null or not private.is_member() then return; end if;
  select timezone, preferences, last_active_date into v_tz, v_prefs, v_last from public.profiles where id = v_uid;
  v_local := now() at time zone v_tz;
  v_today := v_local::date;

  for t in
    select k.id, k.title, k.due_at from public.tasks k
    where k.owner_id = v_uid and k.recurrence = 'none' and k.kind in ('assignment', 'deadline', 'task')
      and k.due_at > now() and k.due_at <= now() + interval '24 hours'
      and not exists (select 1 from public.task_completions c where c.task_id = k.id)
  loop
    perform private.notify(v_uid, 'deadline', 'Due soon: ' || t.title,
      'Due ' || to_char(t.due_at at time zone v_tz, 'Dy HH24:MI'), '/planner', 'due:' || t.id);
  end loop;

  for t in
    select k.id, k.title, (coalesce(k.start_at, k.due_at) at time zone v_tz)::date - v_today as days_left
    from public.tasks k
    where k.owner_id = v_uid and k.recurrence = 'none' and k.kind = 'exam' and coalesce(k.start_at, k.due_at) is not null
      and not exists (select 1 from public.task_completions c where c.task_id = k.id)
  loop
    if t.days_left in (1, 3) then
      perform private.notify(v_uid, 'exam',
        case when t.days_left = 1 then 'Exam tomorrow: ' else 'Exam in 3 days: ' end || t.title,
        'You''ve got this ✦', '/planner', 'exam:' || t.id || ':' || t.days_left);
    end if;
  end loop;

  -- study reminder: nothing that counts for the streak today, and past the start of the earliest preferred time
  select coalesce(min(case x when 'morning' then 8 when 'afternoon' then 13 when 'evening' then 18 when 'night' then 21 end), 18)
    into v_start
    from jsonb_array_elements_text(case when jsonb_typeof(v_prefs -> 'study' -> 'preferredTimes') = 'array'
                                        then v_prefs -> 'study' -> 'preferredTimes' else '["evening"]'::jsonb end) as x;
  if v_last is distinct from v_today and extract(hour from v_local) >= v_start then
    perform private.notify(v_uid, 'study_reminder', 'Time to study ✦', 'Your sky is waiting — even 10 minutes adds a star.',
      '/study', 'study:' || v_today);
  end if;
end $$;
revoke execute on function public.refresh_reminders() from public, anon;
grant execute on function public.refresh_reminders() to authenticated;

revoke execute on function
  private.notify(uuid, text, text, text, text, text),
  private.on_message_before_insert(),
  private.on_message_before_update(),
  private.on_message_after_insert(),
  private.on_note_shared(),
  private.on_deck_shared()
from authenticated, anon, public;
