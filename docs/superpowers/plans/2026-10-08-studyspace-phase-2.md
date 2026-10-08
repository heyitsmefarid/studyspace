# StudySpace Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 2, "The two of you":
- **Our Space:** both skies, stats, activity feed, shooting stars and studying together.
- **Chat:** "Our Room".
- **Notifications:** bell, page, toasts, system notifications and reminders.
- **Achievements and goals.**
- **Clean-up:** remove Market and every "soon" badge.

**Architecture:**
- **Server:** two migrations add the rules:
  - guarded messages
  - notification triggers and reminders
  - the private room channel
  - "together" detection
  - Our Space stats and feed
- **Realtime:** one `RealtimeProvider` in `AppShell` owns the private `room:<id>` channel (Presence + Broadcast) and the Postgres Changes stream.
  - Features listen through small hooks (`useTableChange`, `useRoomEvent`).
  - Incoming rows are written straight into the TanStack Query cache.
- **Feature folders:** each keeps its pure logic (`grouping`, `linkify`, `orbit`, `progress`, …) in unit-tested `.ts` files apart from its React components.

**Tech Stack:**
- React 19, React Router 8, TanStack Query 5
- supabase-js 2: Realtime private channels, Presence, Broadcast, Postgres Changes
- Radix UI (`radix-ui`), Tailwind CSS 4, date-fns 4, lucide-react, sonner
- Vitest 5 (node environment; tests are `src/**/*.test.ts`)
- Postgres/plpgsql on Supabase project `utfcvymxolqipjcptecp`
- No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-studyspace-phase-2-design.md`

## Global Constraints

- **Market is removed.** No page, no menu item, no listing cards in chat. The unused `marketplace_items` table and `market-images` bucket stay in the database (empty, RLS-protected).
- **Notifications are in-app only:** bell, centre and toasts, plus optional system notifications **while StudySpace is open in a tab**. No push when closed, no service worker.
- **Live updates:**
  - Supabase Realtime Postgres Changes for table rows.
  - One **private** channel per room for Presence + Broadcast, authorised by RLS on `realtime.messages`.
  - Clients join with `supabase.channel('room:<id>', { config: { private: true } })`.
- **Not in Phase 2:** push notifications, read receipts, message editing, voice/video, payments, more than one chat room.
- **Message limits:** text is 1–4000 characters after trimming; a shooting star is 1–140; files are ≤ 10 MB in `chat-files/<uid>/…`.
- **Rendering message text:** never as HTML or Markdown. Links are http/https only, with `rel="noopener noreferrer"`.
- **Notification content:**
  - A message notification carries at most 80 characters of text and goes only to the other member.
  - At most one message notification per 10 minutes (dedupe `chat:<room>:<floor(epoch/600)>`).
  - Stars dedupe on `star:<message id>`.
- **Our Space data:** the stats and feed functions return counts and the titles of already-shared items only. Private quiz titles, note titles and AI conversations never leave their owner.
- **Timings:**

  | What | Value |
  |---|---|
  | Typing broadcast | at most every 2 s |
  | Typing indicator | hides after 4 s |
  | Search | debounce 300 ms, limit 30 |
  | Message pages | 50 |
  | Search context | 25 before and 25 after |
  | Reminder refresh | on load and at most hourly on window focus |
  | Studying together | overlap ≥ 600 s |
  | Reconnect backoff | 1 s → 30 s |
  | Shooting-star overlay | ≈ 2.5 s |
  | Message clusters | same sender within 5 minutes |
- **Week start:** Monday 00:00 in the viewer's timezone.
- **Layout and motion:** every screen works at 375 px and on desktop, in Night and Daybreak, with reduced motion respected (CSS through the global reduced-motion rule; JS through `prefersReducedMotion()` / `usePrefersReducedMotion()`).
- **Every task ends green:** `npm test`, `npm run typecheck` and `npm run lint`. The final task also runs `npm run build` and `npm run check:bundle`.
- **Database changes go through the user.** Ask before applying each migration to the live project. Run `supabase/tests/rls_checks.sql` only once both members have signed up; the expected result is the error `RLS CHECKS PASSED`.

## Deviations from the spec (decided while planning)

1. **The server logic is split into two migrations** (`…13_phase2_chat_notifications.sql`, `…14_phase2_space.sql`) so each can be reviewed and applied on its own.
2. **The `star-seen` broadcast is not built.** The spec names it but describes no behaviour.
3. **File chips show the name and type, not the size.** `messages` has no size column, and adding one would widen the scope.
4. **`useSendRoomEvent()` replaces a bare `sendRoomEvent()`**, because sending needs the channel from React context.

## Review Focus

1. **Same message twice.** The sender's optimistic bubble and the Realtime INSERT of the same row must show **one** bubble.
   - Test: Task 6 `cache.test.ts`, "the confirmed row replaces the pending bubble" and "a live insert of a known id does not duplicate it".
2. **Hostile message text.** `<img src=x onerror=alert(1)>` and `javascript:alert(1)` render as plain text; only http(s) URLs become links.
   - Test: Task 6 `linkify.test.ts`.
3. **The partner hasn't joined yet.** Space stats then contain only my row, so the partner block is `null` and the page shows the invite state.
   - Test: Task 8 `stats.test.ts`, "a single member has no partner block".
4. **Devices with different clocks in a shared orbit.** Each device anchors `endsAt` on its own receive time, so both show the same remaining time.
   - Test: Task 10 `orbit.test.ts`, "anchors on the receiver's clock".
5. **Midnight in the viewer's timezone.** In Manila, 23:59 and 00:01 fall on different days even though both are the same UTC date. Chat and notification day groups must split there.
   - Test: Task 4 `days.test.ts` and Task 6 `grouping.test.ts`.

---

### Task 1: Migration 13: private room channel, guarded messages, notification triggers, reminders

**Files:**
- Create: `supabase/migrations/20261006000013_phase2_chat_notifications.sql`
- Modify: `supabase/tests/rls_checks.sql`
- Modify: `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- **Consumes:** existing `private.is_member()`, `private.notify(...)`, `public.study_rooms`, `public.messages`, `public.message_reactions`, `public.notifications`, `public.tasks`, `public.task_completions`, `public.profiles.preferences`.
- **Produces:**
  - **RPC `public.refresh_reminders()`:** returns void. Generated type: `Functions['refresh_reminders']: { Args: never; Returns: undefined }`.
  - **Message inserts:**
    - only accept `kind` `text`, `star` or `file`;
    - trim `body`;
    - set `created_at := now()`;
    - clear `listing_id`.
  - **Message deletion:** any update of `messages.deleted_at` is a delete. It sets `deleted_at := now()`, `body := ''` and nulls the attachment columns, and a deleted message can't change again.
  - **Partner notifications** (kind `message`, link `/chat`):
    - **Text and file messages:** dedupe `chat:<room>:<10-min bucket>`, body = first 80 chars or `📎 <file name>`.
    - **Stars:** dedupe `star:<message id>`, title `<name> sent you a shooting star ✦`.
  - **Shared notes and decks:** notify the partner with kind `shared_note` / `shared_deck` and links `/notes/<id>` / `/decks/<id>`.
  - **Private channel:** topic `room:<study_rooms.id>`, broadcast + presence only, members only.

- [ ] **Step 1: Write the failing database checks**

In `supabase/tests/rls_checks.sql`, extend the `declare` list:

```sql
  rm uuid; m1 uuid; m2 uuid; st uuid; tk uuid; k text;
```

Directly after the two `assert ... 'StudySpace should have exactly two members';` lines, add:

```sql
  -- notification switches start from their defaults (all on) for these checks (0013)
  update public.profiles set preferences = preferences #- '{notifications,kinds}' where id in (a, b);
  select id into rm from public.study_rooms order by created_at limit 1;
```

Immediately before the `-- ── a signed-in account that is not a member cannot invite` block, add:

```sql
  -- ── Phase 2: chat + notifications (0013)
  assert exists (select 1 from public.notifications where user_id = b and dedupe_key like 'shared_note:' || n_shared || ':%'),
    'sharing a note did not notify the partner';
  assert (select count(*) from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname like 'ss room members%') = 2,
    'room channel policies are missing';
  update public.profiles set preferences = jsonb_set(preferences, '{notifications}', '{"kinds": {"message": true}}') where id = b;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert private.is_room_topic('room:' || rm), 'Our Room topic not recognised';
  assert not private.is_room_topic('room:' || gen_random_uuid()), 'an unknown room topic was accepted';
  foreach k in array array['system', 'listing'] loop
    begin
      insert into public.messages (room_id, sender_id, kind, body) values (rm, a, k, 'forged');
      assert false, format('a %s message was accepted', k);
    exception when check_violation then null;
    end;
  end loop;
  begin
    insert into public.messages (room_id, sender_id, kind, body) values (rm, a, 'star', repeat('x', 141));
    assert false, 'a 141-character shooting star was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.messages (room_id, sender_id, kind, body) values (rm, a, 'text', '   ');
    assert false, 'an empty message was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.messages (room_id, sender_id, kind, attachment_path, attachment_name, attachment_mime)
    values (rm, a, 'file', b::text || '/x.pdf', 'x.pdf', 'application/pdf');
    assert false, 'a file from the partner folder was attached';
  exception when check_violation then null;
  end;
  insert into public.messages (room_id, sender_id, kind, body, created_at) values (rm, a, 'text', '  hello  ', now() - interval '3 days')
  returning id into m1;
  assert (select body = 'hello' and created_at = now() from public.messages where id = m1), 'body/created_at were not set by the server';
  begin
    update public.messages set body = 'edited' where id = m1;
    assert false, 'a message body was edited';
  exception when insufficient_privilege then null;
  end;
  update public.messages set deleted_at = now() where id = m1;
  assert (select body = '' and deleted_at is not null from public.messages where id = m1), 'deleting did not blank the message';
  begin
    update public.messages set deleted_at = null where id = m1;
    assert false, 'a deleted message was restored';
  exception when check_violation then null;
  end;
  begin
    insert into public.message_reactions (message_id, user_id, emoji) values (m1, a, '🔥');
    assert false, 'reacted to a deleted message';
  exception when others then if sqlerrm like '%row-level security%' then null; else raise; end if;
  end;
  insert into public.messages (room_id, sender_id, kind, body) values (rm, a, 'star', 'You got this') returning id into st;
  execute 'reset role';
  assert exists (select 1 from public.notifications where user_id = b and dedupe_key = 'star:' || st and link = '/chat'),
    'a shooting star did not notify the partner';
  update public.profiles set preferences = jsonb_set(preferences, '{notifications}', '{"kinds": {"message": false}}') where id = b;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.messages (room_id, sender_id, kind, body) values (rm, a, 'star', 'Water break?') returning id into m2;
  insert into public.tasks (owner_id, title, kind, due_at) values (a, 'RLS due soon', 'deadline', now() + interval '2 hours') returning id into tk;
  perform public.refresh_reminders();
  perform public.refresh_reminders();
  execute 'reset role';
  assert not exists (select 1 from public.notifications where user_id = b and dedupe_key = 'star:' || m2),
    'a switched-off notification kind was delivered';
  assert (select count(*) from public.notifications where user_id = a and dedupe_key = 'due:' || tk) = 1,
    'refresh_reminders did not remind exactly once';
```

- [ ] **Step 2: Run the checks and watch them fail**

First confirm both members exist with the Supabase MCP `execute_sql` tool (project `utfcvymxolqipjcptecp`): `select count(*) from public.profiles;`.
- **If it returns 2:** run the whole of `supabase/tests/rls_checks.sql` with `execute_sql`.
  - Expected: an ERROR naming the first new check, e.g. `sharing a note did not notify the partner`, or `function private.is_room_topic(text) does not exist`.
- **If it returns 1:** note in the task report that the database checks wait for the partner's sign-up. Carry on, because the migration must still apply cleanly.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261006000013_phase2_chat_notifications.sql`:

```sql
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
```

- [ ] **Step 4: Apply the migration (ask first)**

- **Ask the user before applying:** "Apply migration 13 (chat + notifications rules) to the live Supabase project?"
- **On yes:** call the Supabase MCP `apply_migration` tool with project `utfcvymxolqipjcptecp`, name `phase2_chat_notifications` and the file contents as `query`.
- Expected: success. Any error is fixed in the file and applied again.

- [ ] **Step 5: Run the checks and watch them pass**

Run `supabase/tests/rls_checks.sql` with `execute_sql` (only when there are 2 members).
- Expected: `ERROR: RLS CHECKS PASSED`.

- [ ] **Step 6: Ask the user to make the channel private-only**

Tell the user this one-time dashboard step, and wait for them to confirm:
- **Where:** Supabase → Project `utfcvymxolqipjcptecp` → Realtime → Settings, https://supabase.com/dashboard/project/utfcvymxolqipjcptecp/realtime/settings
- **What:** turn **off** "Allow public access".

- [ ] **Step 7: Regenerate the database types**

Run it from the scratchpad, not the repo; the CLI is already logged in.

```bash
cd "$SCRATCHPAD" && npx -y supabase@latest gen types typescript --project-id utfcvymxolqipjcptecp --schema public > "C:/Users/galla/Desktop/StudySpace/src/lib/database.types.ts"
```

Expected: the file now contains `refresh_reminders: {` under `Functions`.

- [ ] **Step 8: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: PASS (no client code uses the new RPC yet).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261006000013_phase2_chat_notifications.sql supabase/tests/rls_checks.sql src/lib/database.types.ts
git commit -m "feat(db): private room channel, guarded messages, notification triggers and reminders"
```

---

### Task 2: Migration 14: studying together, Our Space stats and feed, goal progress floor

**Files:**
- Create: `supabase/migrations/20261006000014_phase2_space.sql`
- Modify: `supabase/tests/rls_checks.sql`
- Modify: `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- **Consumes:** Task 1's migration, plus the existing `private.check_achievements(uuid)` and `private.xp_amount(text)`.
- **Produces:**
  - **`together`:** `study_sessions.together` is set by the server when the other member has a session overlapping the new one by ≥ 600 s. Those partner sessions are marked too, and their achievements re-checked.
  - **`room_id`:** `study_sessions.room_id` keeps only ids of real `study_rooms` rows.
  - **RPC `public.get_space_stats(p_week_start timestamptz)`** returns one row per member, ordered by `profiles.created_at`:
    - `user_id uuid`
    - `focus_seconds_total`, `focus_seconds_week`
    - `cards_total`, `cards_week`
    - `quizzes_total`, `quizzes_week`
    - `achievements`
    - `current_streak`, `longest_streak`, `last_active_date`
    - `together_seconds_total`
  - **RPC `public.space_feed(p_limit integer default 30)`** returns rows `kind text, user_id uuid, at timestamptz, ref_id uuid, title text, detail jsonb`:
    - `kind` is one of `session | quiz | achievement | shared_note | shared_deck`.
    - `detail`:
      - session: `{ minutes, together }`
      - quiz: `{ accuracy }`
      - achievement: `{ icon, code }`
      - shared items: `{}`
  - **Generated TS types:** bigint columns as `number`, the date as `string`.

- [ ] **Step 1: Write the failing database checks**

In `supabase/tests/rls_checks.sql`:
1. Add `s1 uuid; s2 uuid; s3 uuid; s4 uuid;` to `declare`.
2. In the existing study-session loop, change `where user_id = a` to `where user_id in (a, b)`. A partner session overlapping the test window would otherwise make the solo session "together".
3. Immediately before `-- ── a signed-in account that is not a member cannot invite`, add:

```sql
  -- ── Phase 2: studying together, Our Space data (0014)
  t_end := now() - interval '2 minutes';
  while exists (select 1 from public.study_sessions where user_id in (a, b)
                and tstzrange(started_at, ended_at, '[)') && tstzrange(t_end - interval '50 minutes', t_end, '[)')) loop
    t_end := t_end - interval '55 minutes';
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds, room_id)
  values (a, 'custom', t_end - interval '50 minutes', t_end - interval '25 minutes', 1500, gen_random_uuid()) returning id into s1;
  execute 'reset role';
  assert (select room_id is null from public.study_sessions where id = s1), 'an unknown room_id was kept';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds, room_id)
  values (b, 'custom', t_end - interval '40 minutes', t_end - interval '20 minutes', 1200, rm) returning id into s2;
  insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds)
  values (b, 'custom', t_end - interval '19 minutes', t_end - interval '1 minute', 1080) returning id into s3;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds)
  values (a, 'custom', t_end - interval '24 minutes', t_end - interval '15 minutes', 540) returning id into s4;
  execute 'reset role';
  assert (select together from public.study_sessions where id = s2), 'a 15-minute overlap did not mark the new session together';
  assert (select together from public.study_sessions where id = s1), 'the partner''s overlapping session was not marked together';
  assert not (select together from public.study_sessions where id = s3), 'a non-overlapping session was marked together';
  assert not (select together from public.study_sessions where id = s4), 'a 4-minute overlap was marked together';
  assert exists (select 1 from public.user_achievements where user_id = a and achievement_code = 'binary_star'),
    'Binary Star was not unlocked for the partner';

  update public.profiles set preferences = jsonb_set(preferences, '{privacy}', '{"shareActivity": false}') where id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert (select count(*) from public.get_space_stats(now() - interval '7 days')) = 2, 'space stats should have one row per member';
  assert not exists (select 1 from public.space_feed(100) where user_id = a), 'A hid their activity but B still sees it';
  assert exists (select 1 from public.space_feed(100) where user_id = b), 'B does not see their own activity';
  execute 'reset role';
  update public.profiles set preferences = preferences #- '{privacy,shareActivity}' where id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert not exists (select 1 from public.space_feed(100) where title in ('RLS A private', 'RLS quiz', 'RLS A deck private')),
    'space_feed leaked a private title';
  assert exists (select 1 from public.space_feed(100) where kind = 'shared_note' and ref_id = n_shared), 'shared note missing from the feed';
  execute 'reset role';
```

In the existing non-member block (after `perform public.invite_partner('someone@example.com');` … `end;`), add before `execute 'reset role';`:

```sql
  assert (select count(*) from public.get_space_stats(now())) = 0, 'a non-member read space stats';
  assert (select count(*) from public.space_feed(30)) = 0, 'a non-member read the space feed';
```

- [ ] **Step 2: Run the checks and watch them fail**

Run `rls_checks.sql` with `execute_sql` (2 members only).
- Expected: ERROR `a 15-minute overlap did not mark the new session together`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261006000014_phase2_space.sql`:

```sql
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
```

- [ ] **Step 4: Apply the migration (ask first)**

- **Ask:** "Apply migration 14 (studying together + Our Space data) to the live project?"
- **On yes:** `apply_migration` with project `utfcvymxolqipjcptecp`, name `phase2_space`.
- Expected: success.

- [ ] **Step 5: Run the checks and watch them pass**

Run `rls_checks.sql` with `execute_sql` (2 members only).
- Expected: `ERROR: RLS CHECKS PASSED`.

- [ ] **Step 6: Regenerate the types**

Same command as Task 1 Step 7.
- Expected: `get_space_stats: {` and `space_feed: {` appear under `Functions`.

- [ ] **Step 7: Typecheck, test, commit**

Run: `npm run typecheck && npm test`
Expected: PASS.

```bash
git add supabase/migrations/20261006000014_phase2_space.sql supabase/tests/rls_checks.sql src/lib/database.types.ts
git commit -m "feat(db): studying together, Our Space stats and feed, goal progress floor"
```

---

### Task 3: Realtime foundation: provider, presence, reconnect banner, partner dot

**Files:**
- Create: `src/features/realtime/presence.ts`
- Test: `src/features/realtime/presence.test.ts`
- Create: `src/features/realtime/RealtimeProvider.tsx`
- Create: `src/features/realtime/useRealtime.ts`
- Create: `src/features/realtime/ConnectionBanner.tsx`
- Create: `src/features/realtime/PartnerAvatar.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/Sidebar.tsx`

**Interfaces:**
- **Consumes:**
  - `useAuth()` → `{ user, partner, preferences }` (`preferences.privacy.showOnline: boolean`)
  - `supabase` from `@/lib/supabase`
  - `Avatar` from `@/components/sky/Avatar`
- **Produces (later tasks rely on these exact names):**
  - **`presence.ts`:**
    - `PresenceMeta { userId: string; status: 'online' | 'studying'; subject?: string | null; endsAt?: number | null }`
    - `MyStatus = Omit<PresenceMeta, 'userId'>`
    - `PartnerPresence = { state: 'offline' } | { state: 'online' } | { state: 'studying'; subject: string | null; endsAt: number | null }`
    - `partnerPresence(state, partnerId): PartnerPresence`
    - `presenceLabel(p, nowMs): string | null`
    - `backoffMs(attempt): number`
  - **`RealtimeProvider.tsx`:**
    - `RealtimeProvider`, `useRealtime()`, `useOurRoom()` (query → room id string)
    - `type RoomEvent = 'typing' | 'orbit'`
    - `type LiveTable = 'messages' | 'message_reactions' | 'notifications' | 'study_sessions'`
    - `type RowChange` (a Postgres Changes payload), `type ConnectionStatus = 'connecting' | 'live' | 'reconnecting'`
  - **`useRealtime.ts`:**
    - `useConnection(): ConnectionStatus`
    - `usePartnerPresence(): PartnerPresence`
    - `useSetMyStatus(): (s: MyStatus) => void`
    - `useSendRoomEvent(): (event: RoomEvent, payload: Record<string, unknown>) => void`
    - `useRoomEvent(event, handler)`
    - `useTableChange(table, handler)`
  - **`PartnerAvatar.tsx`:**
    - `PresenceDot({ presence, className })`
    - `PartnerAvatar({ size })`
  - **`ConnectionBanner.tsx`:** `ConnectionBanner()`

- [ ] **Step 1: Write the failing tests**

Create `src/features/realtime/presence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { backoffMs, partnerPresence, presenceLabel, type PresenceMeta } from './presence';

const P = 'partner-id';
const meta = (m: Partial<PresenceMeta>): PresenceMeta => ({ userId: P, status: 'online', ...m });

describe('partnerPresence', () => {
  it('is offline without a partner or without their presence', () => {
    expect(partnerPresence({ x: [meta({})] }, null)).toEqual({ state: 'offline' });
    expect(partnerPresence({ me: [meta({ userId: 'me' })] }, P)).toEqual({ state: 'offline' });
  });
  it('is online when any of their tabs is present', () => {
    expect(partnerPresence({ [P]: [meta({})] }, P)).toEqual({ state: 'online' });
  });
  it('prefers studying over online across tabs', () => {
    const state = { [P]: [meta({}), meta({ status: 'studying', subject: 'Biology', endsAt: 1000 })] };
    expect(partnerPresence(state, P)).toEqual({ state: 'studying', subject: 'Biology', endsAt: 1000 });
  });
});

describe('presenceLabel', () => {
  it('describes each state', () => {
    expect(presenceLabel({ state: 'offline' }, 0)).toBeNull();
    expect(presenceLabel({ state: 'online' }, 0)).toBe('Online');
    expect(presenceLabel({ state: 'studying', subject: null, endsAt: null }, 0)).toBe('Studying');
    expect(presenceLabel({ state: 'studying', subject: 'Biology', endsAt: 12 * 60_000 }, 0)).toBe('Studying Biology · 12 min left');
  });
  it('never shows a negative time left', () => {
    expect(presenceLabel({ state: 'studying', subject: 'Art', endsAt: 0 }, 60_000)).toBe('Studying Art · 0 min left');
  });
});

describe('backoffMs', () => {
  it('doubles from 1 s and caps at 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/features/realtime/presence.test.ts`
Expected: FAIL with "Cannot find module './presence'".

- [ ] **Step 3: Implement `presence.ts`**

```ts
export interface PresenceMeta { userId: string; status: 'online' | 'studying'; subject?: string | null; endsAt?: number | null }
export type MyStatus = Omit<PresenceMeta, 'userId'>;
export type PartnerPresence =
  | { state: 'offline' }
  | { state: 'online' }
  | { state: 'studying'; subject: string | null; endsAt: number | null };

/** The partner's status from a channel's presence state (one entry per open tab); studying wins over online. */
export function partnerPresence(state: Record<string, PresenceMeta[]>, partnerId: string | null | undefined): PartnerPresence {
  if (!partnerId) return { state: 'offline' };
  const metas = Object.values(state).flat().filter((m) => m.userId === partnerId);
  if (metas.length === 0) return { state: 'offline' };
  const studying = metas.find((m) => m.status === 'studying');
  return studying ? { state: 'studying', subject: studying.subject ?? null, endsAt: studying.endsAt ?? null } : { state: 'online' };
}

/** "Online", "Studying Biology · 12 min left", "Studying" — or null when offline. */
export function presenceLabel(p: PartnerPresence, now: number): string | null {
  if (p.state === 'offline') return null;
  if (p.state === 'online') return 'Online';
  const what = p.subject ? `Studying ${p.subject}` : 'Studying';
  if (p.endsAt === null) return what;
  return `${what} · ${Math.max(0, Math.ceil((p.endsAt - now) / 60_000))} min left`;
}

/** Reconnect delay: 1 s, 2 s, 4 s … capped at 30 s. */
export const backoffMs = (attempt: number) => Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/features/realtime/presence.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Implement the provider**

Create `src/features/realtime/RealtimeProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { backoffMs, partnerPresence, type MyStatus, type PartnerPresence, type PresenceMeta } from './presence';

export type RoomEvent = 'typing' | 'orbit';
export type LiveTable = 'messages' | 'message_reactions' | 'notifications' | 'study_sessions';
export type RowChange = RealtimePostgresChangesPayload<Record<string, unknown>>;
export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';
type Payload = Record<string, unknown>;

interface RealtimeValue {
  status: ConnectionStatus;
  partner: PartnerPresence;
  setMyStatus: (s: MyStatus) => void;
  send: (event: RoomEvent, payload: Payload) => void;
  onEvent: (event: RoomEvent, handler: (payload: Payload) => void) => () => void;
  onTable: (table: LiveTable, handler: (change: RowChange) => void) => () => void;
}

const noop = () => {};
const RealtimeContext = createContext<RealtimeValue>({
  status: 'connecting', partner: { state: 'offline' }, setMyStatus: noop, send: noop, onEvent: () => noop, onTable: () => noop,
});
export const useRealtime = () => useContext(RealtimeContext);

const TABLES: LiveTable[] = ['messages', 'message_reactions', 'notifications', 'study_sessions'];
/** Refreshed after a dropped connection comes back: events may have been missed meanwhile. */
const RESYNC_KEYS = [['chat'], ['notifications'], ['space'], ['sessions']];

/** The seeded shared room ("Our Room"); one per StudySpace. */
export function useOurRoom() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['our-room'],
    enabled: Boolean(user),
    staleTime: Infinity,
    queryFn: async () => unwrap(await supabase.from('study_rooms').select('id').order('created_at').limit(1).single()).id,
  });
}

function createHub<K, P>() {
  const map = new Map<K, Set<(p: P) => void>>();
  return {
    on: (key: K, handler: (p: P) => void) => {
      const set = map.get(key) ?? new Set<(p: P) => void>();
      set.add(handler);
      map.set(key, set);
      return () => { set.delete(handler); };
    },
    emit: (key: K, p: P) => { map.get(key)?.forEach((h) => h(p)); },
  };
}

/**
 * One private channel `room:<id>` per signed-in session: Presence (online / studying), Broadcast (typing, orbit) and
 * Postgres Changes for the live tables. Reconnects with backoff and refreshes live queries after a drop.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, partner, preferences } = useAuth();
  const qc = useQueryClient();
  const roomId = useOurRoom().data ?? null;
  const uid = user?.id;
  const showOnline = preferences.privacy.showOnline;
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [presence, setPresence] = useState<Record<string, PresenceMeta[]>>({});
  const [events] = useState(() => createHub<RoomEvent, Payload>());
  const [tables] = useState(() => createHub<LiveTable, RowChange>());
  const channel = useRef<RealtimeChannel | null>(null);
  const live = useRef(false);
  const myStatus = useRef<MyStatus>({ status: 'online' });

  const track = useRef(() => {});
  useEffect(() => {
    track.current = () => {
      const ch = channel.current;
      if (!ch || !live.current || !uid) return;
      if (showOnline) void ch.track({ userId: uid, ...myStatus.current });
      else void ch.untrack();
    };
    track.current();
  }, [uid, showOnline]);

  useEffect(() => {
    if (!uid || !roomId) return;
    let disposed = false;
    let attempt = 0;
    let lost = false;
    let retry: number | undefined;
    const connect = () => {
      const ch = supabase.channel(`room:${roomId}`, { config: { private: true, presence: { key: uid } } });
      channel.current = ch;
      ch.on('presence', { event: 'sync' }, () => setPresence({ ...ch.presenceState<PresenceMeta>() }));
      ch.on('broadcast', { event: '*' }, ({ event, payload }) => events.emit(event as RoomEvent, (payload ?? {}) as Payload));
      for (const table of TABLES) {
        const filter = table === 'notifications' ? `user_id=eq.${uid}` : undefined;
        ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, (change: RowChange) => tables.emit(table, change));
      }
      ch.subscribe((s) => {
        if (disposed || channel.current !== ch) return;
        if (s === 'SUBSCRIBED') {
          live.current = true;
          attempt = 0;
          setStatus('live');
          if (lost) {
            lost = false;
            for (const queryKey of RESYNC_KEYS) void qc.invalidateQueries({ queryKey });
          }
          track.current();
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          live.current = false;
          lost = true;
          setStatus('reconnecting');
          setPresence({});
          channel.current = null;
          void supabase.removeChannel(ch);
          retry = window.setTimeout(connect, backoffMs(attempt++));
        }
      });
    };
    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retry);
      live.current = false;
      const ch = channel.current;
      channel.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [uid, roomId, qc, events, tables]);

  // Stable identities: effects that depend on them (e.g. the orbit "hello" after connecting) must not re-run on every presence change.
  const send = useCallback((event: RoomEvent, payload: Payload) => {
    const ch = channel.current;
    if (ch && live.current) void ch.send({ type: 'broadcast', event, payload });
  }, []);
  const setMyStatus = useCallback((s: MyStatus) => { myStatus.current = s; track.current(); }, []);

  const value = useMemo<RealtimeValue>(() => ({
    status,
    partner: partnerPresence(presence, partner?.id),
    setMyStatus,
    send,
    onEvent: events.on,
    onTable: tables.on,
  }), [status, presence, partner?.id, setMyStatus, send, events, tables]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
```

- [ ] **Step 6: Implement the hooks, the banner and the partner avatar**

Create `src/features/realtime/useRealtime.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useRealtime, type LiveTable, type RoomEvent, type RowChange } from './RealtimeProvider';

export const useConnection = () => useRealtime().status;
export const usePartnerPresence = () => useRealtime().partner;
export const useSetMyStatus = () => useRealtime().setMyStatus;
export const useSendRoomEvent = () => useRealtime().send;

/** Runs the latest `handler` for every broadcast of `event` on the room channel. */
export function useRoomEvent(event: RoomEvent, handler: (payload: Record<string, unknown>) => void) {
  const { onEvent } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => onEvent(event, (p) => ref.current(p)), [onEvent, event]);
}

/** Runs the latest `handler` for every Postgres change on `table` that this member may read. */
export function useTableChange(table: LiveTable, handler: (change: RowChange) => void) {
  const { onTable } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => onTable(table, (c) => ref.current(c)), [onTable, table]);
}
```

Create `src/features/realtime/ConnectionBanner.tsx`:

```tsx
import { Loader2 } from 'lucide-react';
import { useConnection } from './useRealtime';

/** Shown while the room channel is reconnecting (the offline banner covers a lost network). */
export function ConnectionBanner() {
  const status = useConnection();
  if (status !== 'reconnecting' || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex animate-[banner-in_320ms_var(--ease-soft)_both] items-center justify-center gap-2 bg-primary-soft py-1.5 text-sm text-primary backdrop-blur">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Reconnecting…
    </div>
  );
}
```

Create `src/features/realtime/PartnerAvatar.tsx`:

```tsx
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { presenceLabel, type PartnerPresence } from './presence';
import { usePartnerPresence } from './useRealtime';

/** Green (teal) = online, gold = studying, nothing = offline. */
export function PresenceDot({ presence, className }: { presence: PartnerPresence; className?: string }) {
  if (presence.state === 'offline') return null;
  return (
    <span aria-hidden className={cn('absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-surface',
      presence.state === 'studying' ? 'bg-gold' : 'bg-teal', className)} />
  );
}

export function PartnerAvatar({ size = 32 }: { size?: number }) {
  const { partner } = useAuth();
  const presence = usePartnerPresence();
  if (!partner) return null;
  const label = presenceLabel(presence, Date.now()) ?? 'Offline';
  return (
    <span className="relative inline-flex" title={`${partner.display_name || 'Your partner'} · ${label}`}>
      <Avatar profile={partner} size={size} />
      <PresenceDot presence={presence} />
      <span className="sr-only">{partner.display_name || 'Your partner'}: {label}</span>
    </span>
  );
}
```

- [ ] **Step 7: Mount it in the shell and show the partner in the sidebar**

In `src/app/AppShell.tsx`:
1. Add the imports:
   ```tsx
   import { RealtimeProvider } from '@/features/realtime/RealtimeProvider';
   import { ConnectionBanner } from '@/features/realtime/ConnectionBanner';
   ```
2. Wrap the returned `<div className="min-h-dvh md:grid …">…</div>` in `<RealtimeProvider>…</RealtimeProvider>`.
3. Add `<ConnectionBanner />` next to `<OfflineBanner />`.

In `src/app/Sidebar.tsx`:
1. Add the import:
   ```tsx
   import { useAuth } from '@/features/auth/AuthProvider';
   import { PartnerAvatar } from '@/features/realtime/PartnerAvatar';
   ```
2. Read `const { partner } = useAuth();` in `Sidebar`.
3. Replace the footer's expanded branch `<ProfileChip />` with:
   ```tsx
   <div className="flex items-center gap-1">
     <div className="min-w-0 flex-1"><ProfileChip /></div>
     {partner && (
       <Link to="/space" className="rounded-full p-1 hover:bg-surface-2" aria-label="Our Space">
         <PartnerAvatar size={32} />
       </Link>
     )}
   </div>
   ```
4. In the collapsed branch, add above `<ThemeToggle />`:
   ```tsx
   {partner && <Link to="/space" className="rounded-full p-1 hover:bg-surface-2" aria-label="Our Space"><PartnerAvatar size={28} /></Link>}
   ```

- [ ] **Step 8: Typecheck, lint, test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

If TypeScript rejects `filter: undefined` in the `postgres_changes` filter object, build the object conditionally instead:

```ts
const config = table === 'notifications'
  ? { event: '*' as const, schema: 'public', table, filter: `user_id=eq.${uid}` }
  : { event: '*' as const, schema: 'public', table };
ch.on('postgres_changes', config, (change: RowChange) => tables.emit(table, change));
```

- [ ] **Step 9: Commit**

```bash
git add src/features/realtime src/app/AppShell.tsx src/app/Sidebar.tsx
git commit -m "feat(realtime): private room channel with presence, broadcast, live tables and reconnect"
```

---

### Task 4: Notifications: day grouping, bell, page, live toasts, system notifications, reminders

**Files:**
- Create: `src/lib/days.ts`
- Test: `src/lib/days.test.ts`
- Create: `src/features/notifications/cache.ts`
- Test: `src/features/notifications/cache.test.ts`
- Create: `src/features/notifications/arrival.ts`
- Test: `src/features/notifications/arrival.test.ts`
- Create: `src/features/notifications/reminders.ts`
- Test: `src/features/notifications/reminders.test.ts`
- Create: `src/features/notifications/api.ts`, `browserNotify.ts`, `toasts.ts`, `NotificationItem.tsx`, `Bell.tsx`, `NotificationsPage.tsx`
- Create: `src/app/LiveSync.tsx`
- Modify: `src/app/AppShell.tsx`, `src/app/routes.tsx`, `src/app/Sidebar.tsx`, `src/app/MobileTabs.tsx`

**Interfaces:**
- **Consumes:**
  - From Task 3: `useTableChange('notifications', handler)`.
  - From Task 1: RPC `refresh_reminders`.
  - Existing: `todayInZone(tz, date)` in `@/features/gamification/streak`, `useAuth()` (`profile.timezone`, `preferences.notifications.browser: boolean`).
- **Produces:**
  - **`days.ts`:**
    - `dayKey(iso: string, tz: string): string` (YYYY-MM-DD)
    - `dayLabel(key: string, todayKey: string): string`
    - `groupByDay<T>(items, at, tz, now): { key: string; label: string; items: T[] }[]`
  - **`notifications/api.ts`:**
    - `AppNotification` (= `Tables<'notifications'>`), `notificationKeys`
    - `useNotifications()`
    - `useUnread(): { total: number; messages: number; messageIds: string[] }`
    - `useMarkRead()` (mutate with `string[] | 'all'`), `useDeleteNotification()`
    - `addIncomingNotification(qc, row)`
  - **`LiveSync`:** a component that later tasks add hooks to.

- [ ] **Step 1: Write the failing tests**

`src/lib/days.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dayKey, dayLabel, groupByDay } from './days';

const TZ = 'Asia/Manila'; // UTC+8, no DST

describe('dayKey', () => {
  it('splits at local midnight, not UTC midnight', () => {
    // 23:59 and 00:01 Manila time are both 2026-10-05 in UTC
    expect(dayKey('2026-10-05T15:59:00Z', TZ)).toBe('2026-10-05');
    expect(dayKey('2026-10-05T16:01:00Z', TZ)).toBe('2026-10-06');
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, then dates', () => {
    expect(dayLabel('2026-10-08', '2026-10-08')).toBe('Today');
    expect(dayLabel('2026-10-07', '2026-10-08')).toBe('Yesterday');
    expect(dayLabel('2026-10-05', '2026-10-08')).toBe('Mon, Oct 5');
  });
});

describe('groupByDay', () => {
  it('keeps order and starts a group whenever the local day changes', () => {
    const items = ['2026-10-08T01:00:00Z', '2026-10-07T17:00:00Z', '2026-10-07T15:00:00Z'];
    const groups = groupByDay(items, (i) => i, TZ, new Date('2026-10-08T02:00:00Z'));
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([['Today', 2], ['Yesterday', 1]]);
  });
});
```

`src/features/notifications/cache.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { markRead, prependUnique, removeById } from './cache';

const n = (id: string, read_at: string | null = null) => ({ id, read_at });

describe('notification cache helpers', () => {
  it('prepends a new notification once', () => {
    const list = [n('a')];
    expect(prependUnique(list, n('b')).map((x) => x.id)).toEqual(['b', 'a']);
    expect(prependUnique(list, n('a'))).toBe(list);
  });
  it('marks chosen or all unread items read, leaving read ones alone', () => {
    const list = [n('a'), n('b', 'earlier'), n('c')];
    expect(markRead(list, ['a'], 'now').map((x) => x.read_at)).toEqual(['now', 'earlier', null]);
    expect(markRead(list, 'all', 'now').map((x) => x.read_at)).toEqual(['now', 'earlier', 'now']);
  });
  it('removes by id', () => {
    expect(removeById([n('a'), n('b')], 'a').map((x) => x.id)).toEqual(['b']);
  });
});
```

`src/features/notifications/arrival.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { arrivalAction, systemAllowed } from './arrival';

const msg = { kind: 'message', dedupe_key: 'chat:r:1' };
const star = { kind: 'message', dedupe_key: 'star:m1' };
const exam = { kind: 'exam', dedupe_key: 'exam:t:1' };
const ctx = (over: Partial<{ pathname: string; hidden: boolean; systemAllowed: boolean }> = {}) =>
  ({ pathname: '/', hidden: false, systemAllowed: false, ...over });

describe('systemAllowed', () => {
  it('needs the switch on and permission granted', () => {
    expect(systemAllowed(true, 'granted')).toBe(true);
    expect(systemAllowed(false, 'granted')).toBe(false);
    expect(systemAllowed(true, 'denied')).toBe(false);
    expect(systemAllowed(true, 'default')).toBe(false);
    expect(systemAllowed(true, 'unsupported')).toBe(false);
  });
});

describe('arrivalAction', () => {
  it('uses a system notification only for a hidden tab with system notifications allowed', () => {
    expect(arrivalAction(exam, ctx({ hidden: true, systemAllowed: true }))).toBe('system');
    expect(arrivalAction(exam, ctx({ hidden: true }))).toBe('toast');
    expect(arrivalAction(exam, ctx({ systemAllowed: true }))).toBe('toast');
  });
  it('marks message notifications read while the chat is open', () => {
    expect(arrivalAction(msg, ctx({ pathname: '/chat' }))).toBe('mark-read');
    expect(arrivalAction(msg, ctx())).toBe('toast');
  });
  it('leaves shooting stars to their overlay', () => {
    expect(arrivalAction(star, ctx())).toBe('silent');
  });
});
```

`src/features/notifications/reminders.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { reminderDue } from './reminders';

describe('reminderDue', () => {
  it('runs the first time, then at most hourly', () => {
    expect(reminderDue(null, 0)).toBe(true);
    expect(reminderDue(0, 59 * 60_000)).toBe(false);
    expect(reminderDue(0, 60 * 60_000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/lib/days.test.ts src/features/notifications`
Expected: FAIL with "Cannot find module" for each of `./days`, `./cache`, `./arrival`, `./reminders`.

- [ ] **Step 3: Implement the pure modules**

`src/lib/days.ts`:

```ts
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { todayInZone } from '@/features/gamification/streak';

/** The calendar day (YYYY-MM-DD) an instant falls on in `tz`. */
export const dayKey = (iso: string, tz: string) => todayInZone(tz, new Date(iso));

/** "Today", "Yesterday" or "Mon, Oct 5" for a day key, relative to `todayKey`. */
export function dayLabel(key: string, todayKey: string): string {
  const diff = differenceInCalendarDays(parseISO(todayKey), parseISO(key));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return format(parseISO(key), 'EEE, MMM d');
}

/** Consecutive runs of items on the same local day, in the order given. */
export function groupByDay<T>(items: T[], at: (item: T) => string, tz: string, now: Date) {
  const today = todayInZone(tz, now);
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = dayKey(at(item), tz);
    const last = groups.at(-1);
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(key, today), items: [item] });
  }
  return groups;
}
```

`src/features/notifications/cache.ts`:

```ts
type Item = { id: string; read_at: string | null };

export const prependUnique = <T extends Item>(list: T[], row: T): T[] => (list.some((x) => x.id === row.id) ? list : [row, ...list]);

export const markRead = <T extends Item>(list: T[], ids: string[] | 'all', at: string): T[] =>
  list.map((x) => (!x.read_at && (ids === 'all' || ids.includes(x.id)) ? { ...x, read_at: at } : x));

export const removeById = <T extends Item>(list: T[], id: string): T[] => list.filter((x) => x.id !== id);
```

`src/features/notifications/arrival.ts`:

```ts
export type Permission = NotificationPermission | 'unsupported';
export type Arrival = 'system' | 'mark-read' | 'silent' | 'toast';

export const systemAllowed = (enabled: boolean, permission: Permission) => enabled && permission === 'granted';

/**
 * What to do when a notification arrives live. Hidden tab + system notifications allowed → a system notification;
 * a message while the chat is open → mark it read; a shooting star → its overlay announces it; otherwise a toast.
 */
export function arrivalAction(
  n: { kind: string; dedupe_key: string | null },
  ctx: { pathname: string; hidden: boolean; systemAllowed: boolean },
): Arrival {
  if (ctx.hidden && ctx.systemAllowed) return 'system';
  if (n.kind === 'message' && ctx.pathname === '/chat' && !ctx.hidden) return 'mark-read';
  if (n.dedupe_key?.startsWith('star:')) return 'silent';
  return 'toast';
}
```

`src/features/notifications/reminders.ts`:

```ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

const HOUR = 3_600_000;
export const reminderDue = (lastMs: number | null, nowMs: number) => lastMs === null || nowMs - lastMs >= HOUR;

let last: number | null = null;

async function refresh() {
  last = Date.now();
  const { error } = await supabase.rpc('refresh_reminders');
  // Silent by design: the next load or focus retries; new reminders arrive through Realtime.
  if (error) console.warn('Reminder refresh failed', error.message);
}

/** Asks the server for due reminders on app load, then at most hourly when the window regains focus. */
export function useReminderRefresh() {
  const ready = Boolean(useAuth().profile);
  useEffect(() => {
    if (!ready) return;
    void refresh();
    const onFocus = () => { if (reminderDue(last, Date.now())) void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [ready]);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/lib/days.test.ts src/features/notifications`
Expected: PASS.

- [ ] **Step 5: Data hooks, system notifications and live arrivals**

`src/features/notifications/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { markRead, prependUnique, removeById } from './cache';

export type AppNotification = Tables<'notifications'>;
export const notificationKeys = { all: ['notifications'] as const, list: ['notifications', 'list'] as const };

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.list,
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200)),
  });
}

/** Unread counts: the bell shows `total`, the Chat nav item `messages`. */
export function useUnread() {
  const unread = (useNotifications().data ?? []).filter((n) => !n.read_at);
  const messageIds = unread.filter((n) => n.kind === 'message').map((n) => n.id);
  return { total: unread.length, messages: messageIds.length, messageIds };
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      const q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      assertOk(await (ids === 'all' ? q : q.in('id', ids)));
    },
    onMutate: (ids) => {
      const at = new Date().toISOString();
      qc.setQueryData<AppNotification[]>(notificationKeys.list, (l) => l && markRead(l, ids, at));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('notifications').delete().eq('id', id)),
    onMutate: (id) => qc.setQueryData<AppNotification[]>(notificationKeys.list, (l) => l && removeById(l, id)),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function addIncomingNotification(qc: QueryClient, row: AppNotification) {
  if (qc.getQueryData(notificationKeys.list)) qc.setQueryData<AppNotification[]>(notificationKeys.list, (l) => l && prependUnique(l, row));
  else void qc.invalidateQueries({ queryKey: notificationKeys.all });
}
```

`src/features/notifications/browserNotify.ts`:

```ts
import type { Permission } from './arrival';

export const systemPermission = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

export async function requestSystemPermission(): Promise<Permission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

/** A system notification that focuses the tab and runs `onOpen` when clicked. Never throws. */
export function showSystemNotification(n: { id: string; title: string; body: string }, onOpen: () => void) {
  try {
    const sys = new Notification(n.title, { body: n.body, tag: n.id, icon: '/favicon.svg' });
    sys.onclick = () => { window.focus(); onOpen(); sys.close(); };
  } catch {
    // some mobile browsers only allow notifications from a service worker; the bell still has it
  }
}
```

`src/features/notifications/toasts.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTableChange } from '@/features/realtime/useRealtime';
import { addIncomingNotification, useMarkRead, type AppNotification } from './api';
import { arrivalAction, systemAllowed } from './arrival';
import { showSystemNotification, systemPermission } from './browserNotify';

/** Mounted once: puts live notifications in the cache and announces them (toast / system notification). */
export function useNotificationArrivals() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { preferences } = useAuth();
  const markRead = useMarkRead();
  const ctx = useRef({ pathname, browser: preferences.notifications.browser });
  useEffect(() => { ctx.current = { pathname, browser: preferences.notifications.browser }; });

  useTableChange('notifications', (change) => {
    if (change.eventType !== 'INSERT') return;
    const n = change.new as AppNotification;
    addIncomingNotification(qc, n);
    const open = () => { markRead.mutate([n.id]); navigate(n.link ?? '/notifications'); };
    const action = arrivalAction(n, {
      pathname: ctx.current.pathname,
      hidden: document.hidden,
      systemAllowed: systemAllowed(ctx.current.browser, systemPermission()),
    });
    if (action === 'system') showSystemNotification(n, open);
    else if (action === 'mark-read') markRead.mutate([n.id]);
    else if (action === 'toast') toast(n.title, { description: n.body || undefined, action: { label: 'Open', onClick: open } });
  });
}
```

- [ ] **Step 6: Bell, item and page**

`src/features/notifications/NotificationItem.tsx`:

```tsx
import { formatDistanceToNowStrict } from 'date-fns';
import { Award, CalendarClock, FileText, Flame, GraduationCap, Layers, MessageCircle, Timer, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AppNotification } from './api';

const ICON: Record<string, LucideIcon> = {
  deadline: CalendarClock, exam: GraduationCap, study_reminder: Timer, message: MessageCircle,
  shared_note: FileText, shared_deck: Layers, achievement: Award, streak: Flame,
};

export function NotificationItem({ n, onOpen, onDelete }: { n: AppNotification; onOpen: () => void; onDelete?: () => void }) {
  const Icon = ICON[n.kind] ?? MessageCircle;
  return (
    <div className={cn('group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2', !n.read_at && 'bg-primary-soft/60')}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-primary"><Icon className="size-4" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{n.title}</span>
          {n.body && <span className="block truncate text-sm text-ink-muted">{n.body}</span>}
          <span className="block text-xs text-ink-faint">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</span>
        </span>
        {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
      </button>
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete notification" className="rounded-lg p-2 text-ink-faint hover:bg-surface hover:text-coral md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
```

`src/features/notifications/Bell.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Popover as R } from 'radix-ui';
import { Bell as BellIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMarkRead, useNotifications, useUnread, type AppNotification } from './api';
import { NotificationItem } from './NotificationItem';

export function Bell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const latest = (useNotifications().data ?? []).slice(0, 5);
  const { total } = useUnread();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const go = (n: AppNotification) => {
    setOpen(false);
    if (!n.read_at) markRead.mutate([n.id]);
    if (n.link) navigate(n.link);
  };
  return (
    <R.Root open={open} onOpenChange={setOpen}>
      <R.Trigger asChild>
        <button className={cn('relative grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-surface-2 hover:text-ink', className)}
          aria-label={total ? `Notifications, ${total} unread` : 'Notifications'}>
          <BellIcon className="size-5" />
          {total > 0 && (
            <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 animate-pop-in place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-primary-ink">
              {total > 9 ? '9+' : total}
            </span>
          )}
        </button>
      </R.Trigger>
      <R.Portal>
        <R.Content align="end" sideOffset={8}
          className="z-50 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-raised p-2 shadow-glow data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="font-display text-lg">Notifications</p>
            {total > 0 && <button onClick={() => markRead.mutate('all')} className="text-xs text-primary hover:underline">Mark all read</button>}
          </div>
          {latest.length === 0
            ? <p className="px-2 py-6 text-center text-sm text-ink-muted">All quiet in your sky.</p>
            : <div className="flex flex-col gap-1">{latest.map((n) => <NotificationItem key={n.id} n={n} onOpen={() => go(n)} />)}</div>}
          <Link to="/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-2 py-2 text-center text-sm font-semibold text-primary hover:bg-surface-2">
            See all
          </Link>
        </R.Content>
      </R.Portal>
    </R.Root>
  );
}
```

`src/features/notifications/NotificationsPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { groupByDay } from '@/lib/days';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TZ } from '@/features/gamification/streak';
import { useDeleteNotification, useMarkRead, useNotifications, useUnread, type AppNotification } from './api';
import { NotificationItem } from './NotificationItem';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const list = useNotifications();
  const { total } = useUnread();
  const markRead = useMarkRead();
  const remove = useDeleteNotification();
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const go = (n: AppNotification) => { if (!n.read_at) markRead.mutate([n.id]); if (n.link) navigate(n.link); };
  const groups = groupByDay(list.data ?? [], (n) => n.created_at, profile?.timezone ?? DEFAULT_TZ, now);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" actions={<Button variant="secondary" disabled={total === 0} onClick={() => markRead.mutate('all')}>Mark all read</Button>} />
      {list.isPending && <Skeleton className="h-60" />}
      {!list.isPending && groups.length === 0 && <EmptyState title="All quiet in your sky" body="Reminders, messages and shared notes will land here." />}
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{g.label}</h2>
            <div className="stagger flex flex-col gap-1 [--stagger-step:30ms]">
              {g.items.map((n) => <NotificationItem key={n.id} n={n} onOpen={() => go(n)} onDelete={() => remove.mutate(n.id)} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire it in**

Create `src/app/LiveSync.tsx`:

```tsx
import { useNotificationArrivals } from '@/features/notifications/toasts';
import { useReminderRefresh } from '@/features/notifications/reminders';

/** App-wide live behaviour that renders nothing. Mounted once inside the RealtimeProvider. */
export function LiveSync() {
  useNotificationArrivals();
  useReminderRefresh();
  return null;
}
```

The remaining wiring:
- **`src/app/AppShell.tsx`:** render `<LiveSync />` inside `<RealtimeProvider>` (next to `<ConnectionBanner />`).
- **`src/app/routes.tsx`:** replace `{ path: 'notifications', element: <Placeholder title="Notifications" /> }` with `r('notifications', () => import('@/features/notifications/NotificationsPage')),`.
- **`src/app/Sidebar.tsx`:** import `Bell` from `@/features/notifications/Bell`.
  - Expanded header: put `<Bell className="size-8" />` before `<ThemeToggle className="size-8" />`.
  - Collapsed footer: put `<Bell />` above `<ThemeToggle />`.
- **`src/app/MobileTabs.tsx`:** import `Bell` and put `<Bell className="size-11" />` before `<ThemeToggle className="size-11" />` in `MobileTopBar`.

- [ ] **Step 8: Typecheck, lint, test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/days.ts src/lib/days.test.ts src/features/notifications src/app/LiveSync.tsx src/app/AppShell.tsx src/app/routes.tsx src/app/Sidebar.tsx src/app/MobileTabs.tsx
git commit -m "feat(notifications): bell, notifications page, live toasts, system notifications and reminders"
```

---

### Task 5: Settings: Notifications and Privacy sections

**Files:**
- Create: `src/features/notifications/kinds.ts`
- Test: `src/features/notifications/kinds.test.ts`
- Create: `src/features/settings/sections/NotificationsSection.tsx`
- Create: `src/features/settings/sections/PrivacySection.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Interfaces:**
- **Consumes:**
  - `useAuth().preferences.notifications: { browser: boolean; kinds: Record<string, boolean> }`
  - `preferences.privacy: { showOnline; shareActivity; shareByDefault }`
  - `useUpdatePreferences()` (deep-merges one level)
  - From Task 4: `systemPermission()`, `requestSystemPermission()`
- **Produces:**
  - `NOTIFICATION_KINDS: readonly { kind; label; hint }[]`
  - `kindEnabled(kinds, kind): boolean`

- [ ] **Step 1: Write the failing test**

`src/features/notifications/kinds.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KINDS, kindEnabled } from './kinds';

describe('notification kinds', () => {
  it('lists exactly the kinds the database allows', () => {
    expect(NOTIFICATION_KINDS.map((k) => k.kind).sort()).toEqual(
      ['achievement', 'deadline', 'exam', 'message', 'shared_deck', 'shared_note', 'streak', 'study_reminder']);
  });
  it('treats a kind as on unless it is explicitly switched off (like private.notify)', () => {
    expect(kindEnabled({}, 'exam')).toBe(true);
    expect(kindEnabled({ exam: true }, 'exam')).toBe(true);
    expect(kindEnabled({ exam: false }, 'exam')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/features/notifications/kinds.test.ts`
Expected: FAIL, "Cannot find module './kinds'".

- [ ] **Step 3: Implement `kinds.ts`**

```ts
export const NOTIFICATION_KINDS = [
  { kind: 'deadline', label: 'Deadlines', hint: 'One-off tasks due within a day.' },
  { kind: 'exam', label: 'Exams', hint: 'Three days and one day before.' },
  { kind: 'study_reminder', label: 'Study reminders', hint: 'When you haven’t studied by your usual time.' },
  { kind: 'message', label: 'Messages and shooting stars', hint: 'From your partner in Our Room.' },
  { kind: 'shared_note', label: 'Shared notes', hint: 'When your partner shares or updates a note.' },
  { kind: 'shared_deck', label: 'Shared decks', hint: 'When your partner shares or updates a deck.' },
  { kind: 'achievement', label: 'Achievements', hint: 'When you unlock one.' },
  { kind: 'streak', label: 'Streaks', hint: 'Your milestones and your partner’s.' },
] as const;

/** Matches private.notify: a kind is on unless it is explicitly switched off. */
export const kindEnabled = (kinds: Record<string, boolean>, kind: string) => kinds[kind] !== false;
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/features/notifications/kinds.test.ts`
Expected: PASS.

- [ ] **Step 5: The two sections**

`src/features/settings/sections/NotificationsSection.tsx`:

```tsx
import { useState } from 'react';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdatePreferences } from '@/features/auth/useProfileMutations';
import { NOTIFICATION_KINDS, kindEnabled } from '@/features/notifications/kinds';
import { requestSystemPermission, systemPermission } from '@/features/notifications/browserNotify';

export function NotificationsSection() {
  const { preferences } = useAuth();
  const update = useUpdatePreferences();
  const n = preferences.notifications;
  const [permission, setPermission] = useState(systemPermission);

  async function toggleSystem(on: boolean) {
    if (!on) { update.mutate({ notifications: { browser: false } }); return; }
    const p = await requestSystemPermission();
    setPermission(p);
    update.mutate({ notifications: { browser: p === 'granted' } });
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink-muted">Notify me about</h3>
        {NOTIFICATION_KINDS.map((k) => (
          <Switch key={k.kind} label={k.label} hint={k.hint} checked={kindEnabled(n.kinds, k.kind)}
            onCheckedChange={(v) => update.mutate({ notifications: { kinds: { ...n.kinds, [k.kind]: v } } })} />
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <Switch label="System notifications" hint="Pop up on your device while StudySpace is open in a tab."
          checked={n.browser && permission === 'granted'} onCheckedChange={(v) => void toggleSystem(v)} />
        {permission === 'unsupported' && <p className="text-xs text-ink-muted">This browser doesn’t support system notifications.</p>}
        {permission === 'denied' && (
          <p role="alert" className="text-xs text-coral">
            Your browser is blocking notifications from StudySpace. Allow them in the site settings (the icon to the left of the address bar), then switch this on again.
          </p>
        )}
      </section>
    </div>
  );
}
```

`src/features/settings/sections/PrivacySection.tsx`:

```tsx
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdatePreferences } from '@/features/auth/useProfileMutations';

export function PrivacySection() {
  const { preferences } = useAuth();
  const update = useUpdatePreferences();
  const p = preferences.privacy;
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Switch label="Show when I’m online" hint="Your partner sees when you’re online or studying." checked={p.showOnline}
        onCheckedChange={(v) => update.mutate({ privacy: { showOnline: v } })} />
      <Switch label="Share my activity in Our Space" hint="Your sessions, quiz scores and achievements appear in the activity feed." checked={p.shareActivity}
        onCheckedChange={(v) => update.mutate({ privacy: { shareActivity: v } })} />
      <Switch label="New items start shared" hint="New notes, decks, quizzes, tasks and goals are shared with your partner." checked={p.shareByDefault}
        onCheckedChange={(v) => update.mutate({ privacy: { shareByDefault: v } })} />
    </div>
  );
}
```

- [ ] **Step 6: Add them to Settings**

In `src/features/settings/SettingsPage.tsx`:
1. Import `Bell` and `Shield` from `lucide-react`, plus the two sections.
2. Insert these after the `appearance` entry in `SECTIONS`:

```tsx
  { id: 'notifications', label: 'Notifications', icon: Bell, render: () => <NotificationsSection /> },
  { id: 'privacy', label: 'Privacy', icon: Shield, render: () => <PrivacySection /> },
```

- [ ] **Step 7: Typecheck, lint, test, commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

```bash
git add src/features/notifications/kinds.ts src/features/notifications/kinds.test.ts src/features/settings
git commit -m "feat(settings): notification kinds, system notifications and privacy switches"
```

---

### Task 6: Chat data layer: grouping, safe links, search escaping, cache, API, live sync

**Files:**
- Create: `src/features/chat/types.ts`
- Create: `src/features/chat/grouping.ts`
- Test: `src/features/chat/grouping.test.ts`
- Create: `src/features/chat/linkify.ts`
- Test: `src/features/chat/linkify.test.ts`
- Create: `src/features/chat/rules.ts`
- Test: `src/features/chat/rules.test.ts`
- Create: `src/features/chat/cache.ts`
- Test: `src/features/chat/cache.test.ts`
- Create: `src/features/chat/api.ts`
- Create: `src/features/chat/sync.ts`
- Modify: `src/app/LiveSync.tsx`

**Interfaces:**
- **Consumes:**
  - From Task 3: `useOurRoom()`, `useTableChange`.
  - From Task 4: `dayKey`, `dayLabel`.
  - Existing: `todayInZone`, `safeContentType`, `safeFileName`, `objectPath`, `removeFile`.
- **Produces:**
  - **`types.ts`:**
    - `Reaction { user_id: string; emoji: string }`
    - `ChatMessage { id; room_id; sender_id; kind: 'text' | 'star' | 'file'; body; attachment_path; attachment_name; attachment_mime; deleted_at; created_at; reactions: Reaction[]; pending?: 'sending' | 'failed' }`
    - `EMOJIS`
  - **`grouping.ts`:** `groupMessages(messages, tz, now): DayGroup[]`, where `DayGroup { key; label; clusters: Cluster[] }` and `Cluster { key; senderId; messages }`.
  - **`linkify.ts`:** `linkify(text): Segment[]`.
  - **`rules.ts`:** `escapeLike(q)`, `attachmentProblem(file)`, `STAR_MAX = 140`, `TEXT_MAX = 4000`, `MAX_FILE_BYTES`.
  - **`cache.ts`:** `MessagePages`, `upsertMessage(data, msg)`, `dropMessage(data, id)`, `applyReaction(data, r, op)`, `flatten(data)`.
  - **`api.ts`:**
    - `chatKeys`, `toMessage(row)`
    - `useMessages()` (infinite)
    - `useOutbox(): { send(draft), retry(id), discard(id) }`, with `Draft = { kind: 'text' | 'star' | 'file'; body: string; file?: File }`; `send` resolves to the confirmed `ChatMessage` and throws on failure
    - `useDeleteMessage()`, `useToggleReaction()`, `useMessageSearch(q)`
    - `loadAround(roomId, target)`
    - `useAttachmentUrl(path, downloadName?)`
  - **`sync.ts`:** `useChatSync()`

- [ ] **Step 1: Write the failing tests**

`src/features/chat/grouping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupMessages } from './grouping';
import type { ChatMessage } from './types';

const TZ = 'Asia/Manila';
const m = (id: string, sender: string, at: string): ChatMessage => ({
  id, room_id: 'r', sender_id: sender, kind: 'text', body: id, attachment_path: null, attachment_name: null,
  attachment_mime: null, deleted_at: null, created_at: at, reactions: [],
});

describe('groupMessages', () => {
  it('starts a new day at local midnight in the viewer timezone', () => {
    const days = groupMessages([m('a', 'x', '2026-10-05T15:59:00Z'), m('b', 'x', '2026-10-05T16:01:00Z')], TZ, new Date('2026-10-06T02:00:00Z'));
    expect(days.map((d) => d.label)).toEqual(['Yesterday', 'Today']);
  });
  it('clusters the same sender within 5 minutes and splits on a gap or a new sender', () => {
    const days = groupMessages([
      m('a', 'x', '2026-10-06T01:00:00Z'), m('b', 'x', '2026-10-06T01:04:00Z'),
      m('c', 'x', '2026-10-06T01:10:00Z'), m('d', 'y', '2026-10-06T01:11:00Z'),
    ], TZ, new Date('2026-10-06T02:00:00Z'));
    expect(days[0]!.clusters.map((c) => c.messages.map((x) => x.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });
});
```

`src/features/chat/linkify.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('turns http(s) URLs into links and leaves trailing punctuation outside', () => {
    expect(linkify('see https://example.com/a.')).toEqual([
      { type: 'text', text: 'see ' },
      { type: 'link', text: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', text: '.' },
    ]);
  });
  it('never links other schemes', () => {
    expect(linkify('javascript:alert(1)')).toEqual([{ type: 'text', text: 'javascript:alert(1)' }]);
    expect(linkify('data:text/html,hi')).toEqual([{ type: 'text', text: 'data:text/html,hi' }]);
  });
  it('keeps HTML as plain text', () => {
    const evil = '<img src=x onerror=alert(1)>';
    expect(linkify(evil)).toEqual([{ type: 'text', text: evil }]);
  });
  it('handles empty text and upper-case schemes', () => {
    expect(linkify('')).toEqual([]);
    expect(linkify('HTTPS://EXAMPLE.COM')).toEqual([{ type: 'link', text: 'HTTPS://EXAMPLE.COM', href: 'https://example.com/' }]);
  });
});
```

`src/features/chat/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, attachmentProblem, escapeLike } from './rules';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50% a_b \\ c')).toBe('50\\% a\\_b \\\\ c');
    expect(escapeLike('plain')).toBe('plain');
  });
});

describe('attachmentProblem', () => {
  it('rejects empty and oversized files', () => {
    expect(attachmentProblem({ size: 0 })).toBe('That file is empty.');
    expect(attachmentProblem({ size: MAX_FILE_BYTES + 1 })).toBe('Files can be up to 10 MB.');
    expect(attachmentProblem({ size: MAX_FILE_BYTES })).toBeNull();
  });
});
```

`src/features/chat/cache.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyReaction, dropMessage, flatten, upsertMessage, type MessagePages } from './cache';
import type { ChatMessage } from './types';

const m = (id: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id, room_id: 'r', sender_id: 'x', kind: 'text', body: id, attachment_path: null, attachment_name: null,
  attachment_mime: null, deleted_at: null, created_at: '2026-10-06T01:00:00Z', reactions: [], ...over,
});
const pages = (...p: ChatMessage[][]): MessagePages => ({ pages: p, pageParams: p.map(() => null) });

describe('chat cache', () => {
  it('puts a new message at the newest end', () => {
    expect(flatten(upsertMessage(pages([m('b'), m('a')]), m('c'))).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('the confirmed row replaces the pending bubble', () => {
    const sent = upsertMessage(pages([m('a')]), m('n', { pending: 'sending' }));
    const confirmed = flatten(upsertMessage(sent, m('n')));
    expect(confirmed.filter((x) => x.id === 'n')).toHaveLength(1);
    expect(confirmed.at(-1)!.pending).toBeUndefined();
  });
  it('a live insert of a known id does not duplicate it', () => {
    const once = upsertMessage(pages([m('a')]), m('b'));
    expect(flatten(upsertMessage(once, m('b')))).toHaveLength(2);
  });
  it('a live update keeps the reactions already loaded', () => {
    const withReaction = pages([m('a', { reactions: [{ user_id: 'y', emoji: '🔥' }] })]);
    const deleted = flatten(upsertMessage(withReaction, m('a', { deleted_at: 'now', body: '' })))[0]!;
    expect(deleted.deleted_at).toBe('now');
    expect(deleted.reactions).toEqual([{ user_id: 'y', emoji: '🔥' }]);
  });
  it('adds a reaction once and removes it', () => {
    const r = { message_id: 'a', user_id: 'y', emoji: '🔥' };
    const added = applyReaction(applyReaction(pages([m('a')]), r, 'add'), r, 'add');
    expect(flatten(added)[0]!.reactions).toHaveLength(1);
    expect(flatten(applyReaction(added, r, 'remove'))[0]!.reactions).toHaveLength(0);
  });
  it('drops a discarded message and leaves an empty cache alone', () => {
    expect(flatten(dropMessage(pages([m('a'), m('b')]), 'a')).map((x) => x.id)).toEqual(['b']);
    expect(upsertMessage(undefined, m('a'))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/features/chat`
Expected: FAIL with "Cannot find module" for `./grouping`, `./linkify`, `./rules`, `./cache`.

- [ ] **Step 3: Implement the pure modules**

`src/features/chat/types.ts`:

```ts
export interface Reaction { user_id: string; emoji: string }
export interface ChatMessage {
  id: string; room_id: string; sender_id: string; kind: 'text' | 'star' | 'file';
  body: string; attachment_path: string | null; attachment_name: string | null; attachment_mime: string | null;
  deleted_at: string | null; created_at: string; reactions: Reaction[];
  /** Client-only: an optimistic message waiting for (or failed at) the server. */
  pending?: 'sending' | 'failed';
}
export const EMOJIS = ['❤️', '🔥', '⭐', '😂', '👏', '💪'] as const;
```

`src/features/chat/grouping.ts`:

```ts
import { dayKey, dayLabel } from '@/lib/days';
import { todayInZone } from '@/features/gamification/streak';
import type { ChatMessage } from './types';

const CLUSTER_GAP_MS = 5 * 60_000;
export interface Cluster { key: string; senderId: string; messages: ChatMessage[] }
export interface DayGroup { key: string; label: string; clusters: Cluster[] }

/** Oldest-first messages → local-day groups of sender clusters (same sender, each ≤ 5 minutes after the last). */
export function groupMessages(messages: ChatMessage[], tz: string, now: Date): DayGroup[] {
  const today = todayInZone(tz, now);
  const days: DayGroup[] = [];
  for (const msg of messages) {
    const key = dayKey(msg.created_at, tz);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(key, today), clusters: [] };
      days.push(day);
    }
    const cluster = day.clusters.at(-1);
    const prev = cluster?.messages.at(-1);
    if (cluster && prev && cluster.senderId === msg.sender_id && Date.parse(msg.created_at) - Date.parse(prev.created_at) <= CLUSTER_GAP_MS) {
      cluster.messages.push(msg);
    } else {
      day.clusters.push({ key: msg.id, senderId: msg.sender_id, messages: [msg] });
    }
  }
  return days;
}
```

`src/features/chat/linkify.ts`:

```ts
export type Segment = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[.,;:!?)\]}]+$/;

/** Splits plain text into text and http(s) link segments. Nothing is ever treated as HTML. */
export function linkify(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0].replace(TRAILING, '');
    const start = match.index;
    let href: string | null = null;
    try {
      const url = new URL(raw);
      if (url.protocol === 'http:' || url.protocol === 'https:') href = url.href;
    } catch {
      href = null;
    }
    if (!href) continue;
    if (start > last) out.push({ type: 'text', text: text.slice(last, start) });
    out.push({ type: 'link', text: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}
```

`src/features/chat/rules.ts`:

```ts
export const TEXT_MAX = 4000;
export const STAR_MAX = 140;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Escapes LIKE wildcards so a search for "50%" or "a_b" matches literally. */
export const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

export function attachmentProblem(file: { size: number }): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'Files can be up to 10 MB.';
  return null;
}
```

`src/features/chat/cache.ts`:

```ts
import type { InfiniteData } from '@tanstack/react-query';
import type { ChatMessage, Reaction } from './types';

/** Newest page first; each page newest message first. */
export type MessagePages = InfiniteData<ChatMessage[], string | null>;

/** Replaces the cached copy (optimistic → confirmed, live → deleted) or adds the message at the newest end. */
export function upsertMessage(data: MessagePages | undefined, msg: ChatMessage): MessagePages | undefined {
  if (!data) return data;
  let found = false;
  const pages = data.pages.map((page) => page.map((m) => {
    if (m.id !== msg.id) return m;
    found = true;
    return { ...msg, reactions: m.reactions };
  }));
  if (found) return { ...data, pages };
  const [first = [], ...rest] = pages;
  return { ...data, pages: [[msg, ...first], ...rest] };
}

export function dropMessage(data: MessagePages | undefined, id: string): MessagePages | undefined {
  return data && { ...data, pages: data.pages.map((page) => page.filter((m) => m.id !== id)) };
}

export function applyReaction(data: MessagePages | undefined, r: Reaction & { message_id: string }, op: 'add' | 'remove'): MessagePages | undefined {
  if (!data) return data;
  const same = (x: Reaction) => x.user_id === r.user_id && x.emoji === r.emoji;
  return {
    ...data,
    pages: data.pages.map((page) => page.map((m) => {
      if (m.id !== r.message_id) return m;
      if (op === 'add') return m.reactions.some(same) ? m : { ...m, reactions: [...m.reactions, { user_id: r.user_id, emoji: r.emoji }] };
      return { ...m, reactions: m.reactions.filter((x) => !same(x)) };
    })),
  };
}

/** Oldest-first list for rendering. */
export const flatten = (data: MessagePages | undefined): ChatMessage[] => (data ? data.pages.flat().reverse() : []);
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/features/chat`
Expected: PASS.

- [ ] **Step 5: API and live sync**

`src/features/chat/api.ts`:

```ts
import { useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AppError, assertOk, friendlyMessage, unwrap } from '@/lib/errors';
import { objectPath, removeFile, safeContentType, safeFileName } from '@/lib/storage';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOurRoom } from '@/features/realtime/RealtimeProvider';
import { applyReaction, dropMessage, upsertMessage, type MessagePages } from './cache';
import { escapeLike } from './rules';
import type { ChatMessage, Reaction } from './types';

export const PAGE = 50;
const COLS = 'id, room_id, sender_id, kind, body, attachment_path, attachment_name, attachment_mime, deleted_at, created_at, message_reactions(user_id, emoji)';
export const chatKeys = {
  all: ['chat'] as const,
  messages: (roomId: string) => ['chat', 'messages', roomId] as const,
  search: (q: string) => ['chat', 'search', q] as const,
};

type Row = Omit<ChatMessage, 'kind' | 'reactions' | 'pending'> & { kind: string; message_reactions?: Reaction[] | null };
export const toMessage = ({ message_reactions, ...row }: Row): ChatMessage => ({
  ...row, kind: row.kind as ChatMessage['kind'], reactions: message_reactions ?? [],
});

export function useMessages() {
  const room = useOurRoom().data;
  return useInfiniteQuery({
    queryKey: chatKeys.messages(room ?? ''),
    enabled: Boolean(room),
    staleTime: Infinity, // kept fresh by Realtime; refreshed after a reconnect
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from('messages').select(COLS).eq('room_id', room!).order('created_at', { ascending: false }).limit(PAGE);
      if (pageParam) q = q.lt('created_at', pageParam);
      return unwrap(await q).map(toMessage);
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]!.created_at : undefined),
  });
}

export interface Draft { kind: ChatMessage['kind']; body: string; file?: File }

async function insertMessage(id: string, roomId: string, senderId: string, d: Draft): Promise<ChatMessage> {
  let attachment = { attachment_path: null as string | null, attachment_name: null as string | null, attachment_mime: null as string | null };
  if (d.file) {
    const path = objectPath(senderId, `${id}-${safeFileName(d.file.name)}`);
    // upsert: a retry after an upload that succeeded (but whose insert failed) must not fail on "already exists"
    const { error } = await supabase.storage.from('chat-files').upload(path, d.file, { contentType: safeContentType(d.file.type), upsert: true });
    if (error) throw new AppError(/exceed|too large/i.test(error.message) ? 'That file is too large.' : friendlyMessage(error), undefined, error);
    attachment = { attachment_path: path, attachment_name: d.file.name.slice(0, 255), attachment_mime: safeContentType(d.file.type) };
  }
  const res = await supabase.from('messages').insert({ id, room_id: roomId, sender_id: senderId, kind: d.kind, body: d.body, ...attachment }).select(COLS).single();
  if (!res.error) return toMessage(res.data);
  // a lost response: the first attempt may already have saved it
  const existing = await supabase.from('messages').select(COLS).eq('id', id).maybeSingle();
  if (existing.data) return toMessage(existing.data);
  throw new AppError(friendlyMessage(res.error), res.error.code, res.error);
}

/** Unsent drafts by message id, so a failed bubble can be retried with its file. */
const drafts = new Map<string, Draft>();

/** Optimistic sending: the bubble appears at once, turns "failed" with Retry/Discard on error; text is never lost. */
export function useOutbox() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const room = useOurRoom().data;
  const put = useCallback((m: ChatMessage) => qc.setQueryData<MessagePages>(chatKeys.messages(room ?? ''), (d) => upsertMessage(d, m)), [qc, room]);

  const deliver = useCallback(async (id: string, d: Draft): Promise<ChatMessage> => {
    if (!room || !user) throw new AppError('Chat isn’t ready yet.');
    drafts.set(id, d);
    const optimistic: ChatMessage = {
      id, room_id: room, sender_id: user.id, kind: d.kind, body: d.body.trim(),
      attachment_path: null, attachment_name: d.file?.name ?? null, attachment_mime: d.file?.type ?? null,
      deleted_at: null, created_at: new Date().toISOString(), reactions: [], pending: 'sending',
    };
    put(optimistic);
    try {
      const saved = await insertMessage(id, room, user.id, d);
      drafts.delete(id);
      put(saved);
      return saved;
    } catch (e) {
      put({ ...optimistic, pending: 'failed' });
      throw e;
    }
  }, [room, user, put]);

  const send = useCallback((d: Draft) => deliver(crypto.randomUUID(), d), [deliver]);
  const retry = useCallback((id: string) => {
    const d = drafts.get(id);
    return d ? deliver(id, d) : Promise.reject(new AppError('That message can’t be retried.'));
  }, [deliver]);
  const discard = useCallback((id: string) => {
    drafts.delete(id);
    qc.setQueryData<MessagePages>(chatKeys.messages(room ?? ''), (d) => dropMessage(d, id));
  }, [qc, room]);
  return { send, retry, discard };
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  const room = useOurRoom().data;
  return useMutation({
    mutationFn: async (m: ChatMessage) => {
      if (m.attachment_path) {
        try { await removeFile('chat-files', m.attachment_path); }
        catch (e) { console.warn('Could not remove the attachment; the message is still deleted.', e); }
      }
      assertOk(await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', m.id));
    },
    onSuccess: (_r, m) => qc.setQueryData<MessagePages>(chatKeys.messages(room ?? ''), (d) => upsertMessage(d, {
      ...m, deleted_at: new Date().toISOString(), body: '', attachment_path: null, attachment_name: null, attachment_mime: null,
    })),
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const room = useOurRoom().data;
  const apply = (messageId: string, emoji: string, op: 'add' | 'remove') =>
    qc.setQueryData<MessagePages>(chatKeys.messages(room ?? ''), (d) => applyReaction(d, { message_id: messageId, user_id: user!.id, emoji }, op));
  return useMutation({
    mutationFn: async ({ messageId, emoji, mine }: { messageId: string; emoji: string; mine: boolean }) => {
      if (mine) assertOk(await supabase.from('message_reactions').delete().match({ message_id: messageId, user_id: user!.id, emoji }));
      else assertOk(await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: user!.id, emoji }, { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true }));
    },
    onMutate: ({ messageId, emoji, mine }) => apply(messageId, emoji, mine ? 'remove' : 'add'),
    onError: (_e, { messageId, emoji, mine }) => apply(messageId, emoji, mine ? 'add' : 'remove'),
  });
}

export function useMessageSearch(q: string) {
  const room = useOurRoom().data;
  const term = q.trim();
  return useQuery({
    queryKey: chatKeys.search(term),
    enabled: Boolean(room) && term.length >= 2,
    queryFn: async () => unwrap(await supabase.from('messages').select(COLS).eq('room_id', room!).is('deleted_at', null)
      .ilike('body', `%${escapeLike(term)}%`).order('created_at', { ascending: false }).limit(30)).map(toMessage),
  });
}

/** The 25 messages before and after `target`, oldest first, for jumping to a search result. */
export async function loadAround(roomId: string, target: ChatMessage): Promise<ChatMessage[]> {
  const [before, after] = await Promise.all([
    supabase.from('messages').select(COLS).eq('room_id', roomId).lt('created_at', target.created_at).order('created_at', { ascending: false }).limit(25),
    supabase.from('messages').select(COLS).eq('room_id', roomId).gt('created_at', target.created_at).order('created_at').limit(25),
  ]);
  return [...unwrap(before).map(toMessage).reverse(), target, ...unwrap(after).map(toMessage)];
}

/** Signed URL for a chat attachment; with `downloadName` the browser saves it instead of opening it. */
export function useAttachmentUrl(path: string | null, downloadName?: string) {
  return useQuery({
    queryKey: ['signed-url', 'chat-files', path, downloadName ?? ''],
    enabled: Boolean(path),
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('chat-files').createSignedUrl(path!, 3600, downloadName ? { download: downloadName } : undefined);
      if (error) throw new AppError(friendlyMessage(error));
      return data.signedUrl;
    },
  }).data;
}
```

`src/features/chat/sync.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { useOurRoom } from '@/features/realtime/RealtimeProvider';
import { useTableChange } from '@/features/realtime/useRealtime';
import { applyReaction, upsertMessage, type MessagePages } from './cache';
import { chatKeys, toMessage } from './api';

/** Mounted once: keeps the cached conversation in step with Realtime (new, deleted, reactions). */
export function useChatSync() {
  const qc = useQueryClient();
  const room = useOurRoom().data;
  useTableChange('messages', (c) => {
    if (!room || c.eventType === 'DELETE') return;
    const row = toMessage(c.new as Parameters<typeof toMessage>[0]);
    if (row.room_id !== room) return;
    qc.setQueryData<MessagePages>(chatKeys.messages(room), (d) => upsertMessage(d, row));
  });
  useTableChange('message_reactions', (c) => {
    if (!room) return;
    const r = (c.eventType === 'DELETE' ? c.old : c.new) as { message_id?: string; user_id?: string; emoji?: string };
    if (!r.message_id || !r.user_id || !r.emoji) return;
    qc.setQueryData<MessagePages>(chatKeys.messages(room), (d) =>
      applyReaction(d, { message_id: r.message_id!, user_id: r.user_id!, emoji: r.emoji! }, c.eventType === 'DELETE' ? 'remove' : 'add'));
  });
}
```

In `src/app/LiveSync.tsx`, import `useChatSync` from `@/features/chat/sync` and call it after `useReminderRefresh()`.

- [ ] **Step 6: Typecheck, lint, test, commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

```bash
git add src/features/chat src/app/LiveSync.tsx
git commit -m "feat(chat): message grouping, safe links, search, optimistic outbox and live cache sync"
```

---

### Task 7: Chat UI: Our Room

**Files:**
- Create: `src/features/chat/typing.ts`
- Test: `src/features/chat/typing.test.ts`
- Create: `src/features/chat/useTyping.ts`, `ChatPage.tsx`, `ChatHeader.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `ReactionBar.tsx`, `Composer.tsx`, `TypingIndicator.tsx`, `SearchPanel.tsx`
- Modify: `src/app/routes.tsx`, `src/app/Sidebar.tsx`, `src/app/MoreSheet.tsx`

**Interfaces:**
- **Consumes:**
  - Everything from Task 6.
  - From Task 3: `useRoomEvent('typing')`, `useSendRoomEvent()`, `useTableChange('messages')`, `usePartnerPresence()`, `PresenceDot`, `presenceLabel`.
  - From Task 4: `useUnread()`, `useMarkRead()`.
  - Existing: `useDebouncedValue` from `@/lib/useDebouncedValue` (check its parameter order before use), `Avatar`, `Sheet`, `Menu`, `ConfirmDialog`, `EmptyState`, `opensInline(mime)`, `excerpt(text, max)`.
- **Produces:**
  - Route `/chat`.
  - **`Composer`** props: `{ onTyping: () => void; extra?: ReactNode }`. Task 9 passes the star button as `extra`.
  - **`typing.ts`:** `shouldSendTyping(lastSent, now)`, `TYPING_SEND_EVERY_MS`, `TYPING_SHOW_MS`.

- [ ] **Step 1: Write the failing test**

`src/features/chat/typing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TYPING_SEND_EVERY_MS, shouldSendTyping } from './typing';

describe('shouldSendTyping', () => {
  it('sends the first keystroke, then at most every 2 s', () => {
    expect(shouldSendTyping(null, 0)).toBe(true);
    expect(shouldSendTyping(0, TYPING_SEND_EVERY_MS - 1)).toBe(false);
    expect(shouldSendTyping(0, TYPING_SEND_EVERY_MS)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/features/chat/typing.test.ts`
Expected: FAIL, "Cannot find module './typing'".

- [ ] **Step 3: Implement typing**

`src/features/chat/typing.ts`:

```ts
export const TYPING_SEND_EVERY_MS = 2000;
export const TYPING_SHOW_MS = 4000;
export const shouldSendTyping = (lastSent: number | null, now: number) => lastSent === null || now - lastSent >= TYPING_SEND_EVERY_MS;
```

`src/features/chat/useTyping.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRoomEvent, useSendRoomEvent, useTableChange } from '@/features/realtime/useRealtime';
import { TYPING_SHOW_MS, shouldSendTyping } from './typing';

/** "<partner> is typing…" for 4 s after their last typing event, cleared when their message lands. */
export function useTyping() {
  const { user, partner } = useAuth();
  const send = useSendRoomEvent();
  const lastSent = useRef<number | null>(null);
  const [heardAt, setHeardAt] = useState<number | null>(null);
  useRoomEvent('typing', (p) => { if (p.userId === partner?.id) setHeardAt(Date.now()); });
  useTableChange('messages', (c) => {
    if (c.eventType === 'INSERT' && (c.new as { sender_id?: string }).sender_id === partner?.id) setHeardAt(null);
  });
  useEffect(() => {
    if (heardAt === null) return;
    const t = window.setTimeout(() => setHeardAt(null), TYPING_SHOW_MS);
    return () => window.clearTimeout(t);
  }, [heardAt]);
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!shouldSendTyping(lastSent.current, now)) return;
    lastSent.current = now;
    send('typing', { userId: user?.id });
  }, [send, user?.id]);
  return { partnerTyping: heardAt !== null, notifyTyping };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/features/chat/typing.test.ts`
Expected: PASS.

- [ ] **Step 5: Bubble, reactions and typing indicator**

`src/features/chat/ReactionBar.tsx`:

```tsx
import { EMOJIS } from './types';

export function ReactionBar({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div role="toolbar" aria-label="React" className="flex animate-pop-in gap-0.5 rounded-full border border-line bg-raised p-1 shadow-glow">
      {EMOJIS.map((e) => (
        <button key={e} onClick={() => onPick(e)} className="grid size-9 place-items-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-surface-2" aria-label={`React ${e}`}>{e}</button>
      ))}
    </div>
  );
}
```

`src/features/chat/TypingIndicator.tsx`:

```tsx
export function TypingIndicator({ name }: { name: string }) {
  return (
    <p role="status" className="flex items-center gap-2 px-2 text-xs text-ink-muted">
      <span aria-hidden className="flex gap-0.5">
        {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-twinkle rounded-full bg-ink-faint" style={{ animationDelay: `${i * 160}ms` }} />)}
      </span>
      {name} is typing…
    </p>
  );
}
```

`src/features/chat/MessageBubble.tsx`:

```tsx
import { useRef, useState, type PointerEvent } from 'react';
import { MoreHorizontal, Paperclip, RotateCcw, SmilePlus, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { friendlyMessage } from '@/lib/errors';
import { opensInline } from '@/lib/storage';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Menu } from '@/components/ui/Menu';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAttachmentUrl, useDeleteMessage, useOutbox, useToggleReaction } from './api';
import { linkify } from './linkify';
import { ReactionBar } from './ReactionBar';
import type { ChatMessage } from './types';

function Text({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap break-words">
      {linkify(body).map((s, i) => (s.type === 'link'
        ? <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{s.text}</a>
        : <span key={i}>{s.text}</span>))}
    </p>
  );
}

function Attachment({ m }: { m: ChatMessage }) {
  const isImage = Boolean(m.attachment_mime?.startsWith('image/')) && opensInline(m.attachment_mime ?? '');
  const url = useAttachmentUrl(m.attachment_path, isImage ? undefined : m.attachment_name ?? 'file');
  if (!m.attachment_path) return <p className="flex items-center gap-2 text-sm"><Paperclip className="size-4" aria-hidden /> {m.attachment_name}</p>;
  if (isImage) {
    return url
      ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={m.attachment_name ?? 'Image'} className="max-h-64 rounded-xl object-cover" /></a>
      : <div className="h-40 w-56 animate-pulse rounded-xl bg-surface-2" />;
  }
  return (
    <a href={url} rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2 text-sm">
      <Paperclip className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0"><span className="block truncate font-semibold">{m.attachment_name}</span><span className="block text-xs opacity-75">{m.attachment_mime}</span></span>
    </a>
  );
}

export function MessageBubble({ m, highlight }: { m: ChatMessage; highlight?: boolean }) {
  const { user } = useAuth();
  const mine = m.sender_id === user?.id;
  const [reacting, setReacting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const press = useRef<number | undefined>(undefined);
  const outbox = useOutbox();
  const del = useDeleteMessage();
  const react = useToggleReaction();
  const deleted = Boolean(m.deleted_at);

  const pick = (emoji: string) => {
    setReacting(false);
    react.mutate({ messageId: m.id, emoji, mine: m.reactions.some((r) => r.user_id === user?.id && r.emoji === emoji) });
  };
  // long-press on touch opens the reaction bar (hover handles it on desktop)
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || deleted || m.pending) return;
    press.current = window.setTimeout(() => setReacting(true), 450);
  };
  const cancelPress = () => window.clearTimeout(press.current);
  const counts = new Map<string, { n: number; mine: boolean }>();
  for (const r of m.reactions) {
    const c = counts.get(r.emoji) ?? { n: 0, mine: false };
    counts.set(r.emoji, { n: c.n + 1, mine: c.mine || r.user_id === user?.id });
  }

  return (
    <div className={cn('group flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div className="relative flex max-w-[85%] items-center gap-1 sm:max-w-[70%]">
        {!deleted && !m.pending && (
          <div className={cn('hidden items-center gap-0.5 md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100', mine ? 'order-first' : 'order-last')}>
            <button onClick={() => setReacting((r) => !r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink" aria-label="React"><SmilePlus className="size-4" /></button>
            {mine && (
              <Menu trigger={<button className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink" aria-label="Message options"><MoreHorizontal className="size-4" /></button>}
                items={[{ label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirming(true) }]} />
            )}
          </div>
        )}
        <div
          onPointerDown={onPointerDown} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerMove={cancelPress}
          className={cn('rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed',
            m.kind === 'star' && !deleted ? 'border border-gold/40 bg-gold-soft text-ink'
              : mine ? 'bg-[linear-gradient(135deg,var(--primary),var(--primary-2))] text-primary-ink' : 'border border-line bg-surface text-ink',
            m.pending === 'sending' && 'opacity-60', m.pending === 'failed' && 'ring-2 ring-coral',
            highlight && 'animate-pulse-once')}
        >
          {deleted ? <p className="italic opacity-80">message deleted</p> : (<>
            {m.kind === 'star' && <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-gold"><Sparkles className="size-3.5" aria-hidden /> Shooting star</p>}
            {m.kind === 'file' && <Attachment m={m} />}
            {m.body && <Text body={m.body} />}
          </>)}
        </div>
        {reacting && <div className={cn('absolute -top-12 z-10', mine ? 'right-0' : 'left-0')}><ReactionBar onPick={pick} /></div>}
      </div>
      {counts.size > 0 && (
        <div className="flex flex-wrap gap-1">
          {[...counts].map(([emoji, c]) => (
            <button key={emoji} onClick={() => pick(emoji)} aria-pressed={c.mine}
              className={cn('rounded-full border px-2 py-0.5 text-xs', c.mine ? 'border-primary bg-primary-soft' : 'border-line bg-surface')}>
              {emoji} {c.n}
            </button>
          ))}
        </div>
      )}
      {m.pending === 'failed' && (
        <div className="flex items-center gap-2 text-xs text-coral">
          Not sent.
          <button className="inline-flex items-center gap-1 underline" onClick={() => outbox.retry(m.id).catch((e: unknown) => toast.error(friendlyMessage(e)))}><RotateCcw className="size-3" /> Retry</button>
          <button className="inline-flex items-center gap-1 underline" onClick={() => outbox.discard(m.id)}><X className="size-3" /> Discard</button>
        </div>
      )}
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title="Delete this message?" body="It disappears for both of you." confirmLabel="Delete" danger
        onConfirm={() => del.mutateAsync(m)} />
    </div>
  );
}
```

- [ ] **Step 6: List, composer, search, header and page**

`src/features/chat/MessageList.tsx`:

```tsx
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ArrowDown } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TZ } from '@/features/gamification/streak';
import { groupMessages } from './grouping';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from './types';

/** Stays pinned to the newest message when already there; otherwise offers a "New messages" pill. Loads older pages near the top. */
export function MessageList({ messages, hasOlder, loadOlder, highlightId, footer }: {
  messages: ChatMessage[]; hasOlder: boolean; loadOlder: () => Promise<unknown>; highlightId?: string | null; footer?: ReactNode;
}) {
  const { profile } = useAuth();
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const loading = useRef(false);
  const [showPill, setShowPill] = useState(false);
  const [now] = useState(() => new Date());
  const lastId = messages.at(-1)?.id;
  const days = groupMessages(messages, profile?.timezone ?? DEFAULT_TZ, now);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (restore.current) {
      el.scrollTop = el.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else if (lastId) {
      setShowPill(true);
    }
  }, [messages.length, lastId]);

  useEffect(() => {
    if (highlightId) box.current?.querySelector(`[data-mid="${highlightId}"]`)?.scrollIntoView({ block: 'center' });
  }, [highlightId]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setShowPill(false);
    if (el.scrollTop < 120 && hasOlder && !loading.current) {
      loading.current = true;
      restore.current = { height: el.scrollHeight, top: el.scrollTop };
      void loadOlder().finally(() => { loading.current = false; });
    }
  };
  const toBottom = () => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
    setShowPill(false);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={box} onScroll={onScroll} className="h-full overflow-y-auto px-1 py-3" aria-live="polite" aria-relevant="additions">
        {days.map((d) => (
          <section key={d.key} aria-label={d.label} className="mb-4">
            <p className="sticky top-0 z-10 mx-auto mb-2 w-fit rounded-full bg-surface-2/90 px-3 py-0.5 text-xs text-ink-muted backdrop-blur">{d.label}</p>
            <div className="flex flex-col gap-3">
              {d.clusters.map((c) => (
                <div key={c.key} className="flex flex-col gap-1">
                  {c.messages.map((m) => <div key={m.id} data-mid={m.id}><MessageBubble m={m} highlight={m.id === highlightId} /></div>)}
                  <p className={c.senderId === profile?.id ? 'text-right text-[11px] text-ink-faint' : 'text-[11px] text-ink-faint'}>
                    {format(new Date(c.messages.at(-1)!.created_at), 'p')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
        {footer}
      </div>
      {showPill && (
        <button onClick={toBottom} className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 animate-pop-in items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-ink shadow-glow">
          New messages <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
```

`src/features/chat/Composer.tsx`:

```tsx
import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Paperclip, SendHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { useOutbox } from './api';
import { TEXT_MAX, attachmentProblem } from './rules';

const MAX_HEIGHT = 8 * 24 + 20;
const grow = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`; };

export function Composer({ onTyping, extra }: { onTyping: () => void; extra?: ReactNode }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const outbox = useOutbox();

  const attach = (f: File | undefined | null) => {
    if (!f) return;
    const problem = attachmentProblem(f);
    setError(problem);
    if (!problem) setFile(f);
  };
  const submit = () => {
    const body = text.trim();
    if (!body && !file) return;
    const draft = file ? { kind: 'file' as const, body, file } : { kind: 'text' as const, body };
    setText(''); setFile(null); setError(null);
    if (area.current) area.current.style.height = 'auto';
    // on failure the bubble stays (with Retry/Discard) and the toast says why
    outbox.send(draft).catch((e: unknown) => toast.error(friendlyMessage(e)));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  const onPaste = (e: ClipboardEvent) => { const f = e.clipboardData.files[0]; if (f) { e.preventDefault(); attach(f); } };
  const onDrop = (e: DragEvent) => { e.preventDefault(); attach(e.dataTransfer.files[0]); };

  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="flex flex-col gap-1">
      {error && <p role="alert" className="px-2 text-xs text-coral">{error}</p>}
      {file && (
        <p className="flex w-fit items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-sm">
          <Paperclip className="size-3.5" aria-hidden /> <span className="max-w-56 truncate">{file.name}</span>
          <button onClick={() => setFile(null)} aria-label="Remove attachment"><X className="size-3.5" /></button>
        </p>
      )}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-end gap-1 rounded-2xl border border-line bg-surface p-2 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--primary-soft)]">
        <input ref={picker} type="file" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => picker.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Attach a file">
          <Paperclip className="size-5" />
        </button>
        {extra}
        <textarea ref={area} aria-label="Message" rows={1} maxLength={TEXT_MAX} value={text} placeholder="Write a message…"
          onChange={(e) => { setText(e.target.value); grow(e.target); onTyping(); }} onKeyDown={onKeyDown} onPaste={onPaste}
          className="block max-h-52 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-ink placeholder:text-ink-faint focus:outline-none" />
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() && !file} className={cn('rounded-xl', (text.trim() || file) && '-translate-y-px')}>
          <SendHorizontal className="size-5" />
        </Button>
      </form>
    </div>
  );
}
```

`src/features/chat/SearchPanel.tsx`:

```tsx
import { useState } from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { excerpt } from '@/lib/text';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useMessageSearch } from './api';
import type { ChatMessage } from './types';

export function SearchPanel({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (m: ChatMessage) => void }) {
  const [q, setQ] = useState('');
  const term = useDebouncedValue(q, 300);
  const results = useMessageSearch(term);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" title="Search messages">
      <Input autoFocus type="search" aria-label="Search messages" placeholder="Search Our Room…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 flex flex-col gap-1">
        {term.trim().length >= 2 && results.data?.length === 0 && <p className="text-sm text-ink-muted">No messages match.</p>}
        {results.data?.map((m) => (
          <button key={m.id} onClick={() => { onPick(m); onOpenChange(false); }} className="rounded-xl p-2 text-left hover:bg-surface-2">
            <span className="block text-sm">{excerpt(m.body, 120)}</span>
            <span className="block text-xs text-ink-faint">{format(new Date(m.created_at), 'PP p')}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
```

`src/features/chat/ChatHeader.tsx`:

```tsx
import { Search } from 'lucide-react';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { PresenceDot } from '@/features/realtime/PartnerAvatar';
import { presenceLabel } from '@/features/realtime/presence';
import { usePartnerPresence } from '@/features/realtime/useRealtime';

export function ChatHeader({ onSearch }: { onSearch: () => void }) {
  const { partner } = useAuth();
  const presence = usePartnerPresence();
  return (
    <header className="flex items-center gap-3 border-b border-line pb-3">
      <span className="relative inline-flex"><Avatar profile={partner} size={40} /><PresenceDot presence={presence} /></span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-xl">{partner?.display_name || 'Your partner'}</h1>
        <p className="text-xs text-ink-muted">{presenceLabel(presence, Date.now()) ?? 'Our Room'}</p>
      </div>
      <button onClick={onSearch} className="grid size-10 place-items-center rounded-xl text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Search messages">
        <Search className="size-5" />
      </button>
    </header>
  );
}
```

`src/features/chat/ChatPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOurRoom } from '@/features/realtime/RealtimeProvider';
import { useConnection } from '@/features/realtime/useRealtime';
import { useMarkRead, useUnread } from '@/features/notifications/api';
import { loadAround, useMessages, useOutbox } from './api';
import { flatten } from './cache';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { SearchPanel } from './SearchPanel';
import { TypingIndicator } from './TypingIndicator';
import { useTyping } from './useTyping';
import type { ChatMessage } from './types';

export default function ChatPage() {
  const { partner } = useAuth();
  const room = useOurRoom().data;
  const messages = useMessages();
  const { partnerTyping, notifyTyping } = useTyping();
  const { messageIds } = useUnread();
  const markRead = useMarkRead();
  const [searching, setSearching] = useState(false);
  const [around, setAround] = useState<{ list: ChatMessage[]; id: string } | null>(null);
  const unreadKey = messageIds.join(',');
  const status = useConnection();
  const outbox = useOutbox();

  // Messages that failed while offline are retried once the room channel is live again (Retry stays available).
  useEffect(() => {
    if (status !== 'live') return;
    for (const m of flatten(messages.data)) if (m.pending === 'failed') outbox.retry(m.id).catch(() => { /* stays failed, with Retry */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on (re)connect
  }, [status]);

  // While the chat is open, its message notifications count as read.
  useEffect(() => {
    if (unreadKey) markRead.mutate(unreadKey.split(','));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the unread set changes
  }, [unreadKey]);

  if (!partner) {
    return <EmptyState title="Our Room is waiting for two" body="Invite your partner and this becomes your shared chat."
      action={<Link to="/settings/partner" className="text-primary underline">Invite your partner</Link>} />;
  }

  const jump = async (m: ChatMessage) => {
    try { setAround({ list: await loadAround(room!, m), id: m.id }); }
    catch (e) { toast.error(friendlyMessage(e)); }
  };
  const live = flatten(messages.data);

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-96 flex-col gap-3 md:h-[calc(100dvh-5rem)]">
      <ChatHeader onSearch={() => setSearching(true)} />
      {around && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm">
          Showing an older part of the conversation.
          <Button size="sm" variant="secondary" onClick={() => setAround(null)}>Back to latest</Button>
        </div>
      )}
      {messages.isPending ? <Skeleton className="flex-1" /> : (
        <MessageList
          messages={around ? around.list : live}
          hasOlder={!around && Boolean(messages.hasNextPage)}
          loadOlder={() => messages.fetchNextPage()}
          highlightId={around?.id}
          footer={partnerTyping ? <TypingIndicator name={partner.display_name || 'Your partner'} /> : null}
        />
      )}
      {!messages.isPending && live.length === 0 && !around && <p className="text-center text-sm text-ink-muted">Say hi, this is your shared corner of the sky ✦</p>}
      <Composer onTyping={notifyTyping} />
      <SearchPanel open={searching} onOpenChange={setSearching} onPick={(m) => void jump(m)} />
    </div>
  );
}
```

- [ ] **Step 7: Route and nav badge**

**`src/app/routes.tsx`:** replace the chat placeholder with `r('chat', () => import('@/features/chat/ChatPage')),`.

**`src/app/Sidebar.tsx`:**
1. Import `useUnread` from `@/features/notifications/api`.
2. Read `const { messages: unreadMessages } = useUnread();`.
3. Inside the NavLink body, after `{!collapsed && <span className="flex-1">{label}</span>}`, add:
   ```tsx
   {!collapsed && to === '/chat' && unreadMessages > 0 && <Badge tone="coral">{unreadMessages > 9 ? '9+' : unreadMessages}</Badge>}
   ```

**`src/app/MoreSheet.tsx`:**
1. Import `useUnread`.
2. Read `const { messages: unreadMessages } = useUnread();`.
3. In the label row, add:
   ```tsx
   {to === '/chat' && unreadMessages > 0 && <Badge tone="coral">{unreadMessages}</Badge>}
   ```

- [ ] **Step 8: Typecheck, lint, test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 9: Visual check**

With the dev server on :5174:
- **If `.env.local` has `SMOKE_EMAIL`/`SMOKE_PASSWORD`:** run `MSYS_NO_PATHCONV=1 SHOOT_WAIT=1500 node scripts/shoot.mjs /chat` and read the PNGs in `.shots/`.
  - Expected: header, conversation (or empty line) and composer fit at 375 px and on desktop, in both themes, with no overflow warning.
- **Otherwise:** say so in the report. The manual two-browser pass in Task 12 covers it.

- [ ] **Step 10: Commit**

```bash
git add src/features/chat src/app/routes.tsx src/app/Sidebar.tsx src/app/MoreSheet.tsx
git commit -m "feat(chat): Our Room with live messages, files, reactions, typing, search and delete"
```

---

### Task 8: Our Space: week boundary, stats, both skies, partner card, activity feed

**Files:**
- Create: `src/features/space/week.ts`
- Test: `src/features/space/week.test.ts`
- Create: `src/features/space/stats.ts`
- Test: `src/features/space/stats.test.ts`
- Create: `src/features/space/feed.ts`
- Test: `src/features/space/feed.test.ts`
- Create: `src/features/space/ourSky.ts`
- Test: `src/features/space/ourSky.test.ts`
- Create: `src/features/space/api.ts`, `OurSky.tsx`, `StatBlocks.tsx`, `PartnerCard.tsx`, `ActivityFeed.tsx`, `SpacePage.tsx`
- Modify: `src/app/routes.tsx`, `src/app/LiveSync.tsx`

**Interfaces:**
- **Consumes:**
  - From Task 2: RPCs `get_space_stats`, `space_feed`.
  - From Task 3: `useTableChange`, `usePartnerPresence`, `PresenceDot`, `presenceLabel`.
  - Existing:
    - `layoutSky(sessions, subjects, { width, height, now, meColor, maxStars })` and the `SkySession`/`SkySubject`/`SkyStar` types from `@/features/dashboard/sky`
    - `useSessions(sinceIso, userId?)` (rows include `ended_at` and `together`), `useSubjects()`
    - `effectiveStreak`, `todayInZone`, `DEFAULT_TZ`, `useCountUp(value, ms)`, `formatDuration(seconds)`
- **Produces:**
  - **`week.ts`:** `weekStartIso(tz, now): string`, `zoneOffsetMs(tz, utcMs)`.
  - **`stats.ts`:**
    - `SpaceStatsRow`
    - `MemberBlock { userId; streak; weekSeconds; totalSeconds; cardsWeek; quizzesWeek; achievements }`
    - `spaceBlocks(rows, me, partner, now): { me: MemberBlock | null; partner: MemberBlock | null; togetherSeconds: number }`
  - **`feed.ts`:** `FeedItem`, `describeFeedItem(item, who): { text; href }`.
  - **`ourSky.ts`:** `OurSession`, `layoutOurSky(me, partner, subjects, opts)`.
  - **`api.ts`:** `spaceKeys`, `useSpaceStats()`, `useSpaceFeed()`, `useSpaceSync()`.
  - **`PartnerCard`** props `{ actions?: ReactNode }`, and **`ActivityFeed`** props `{ cheer?: (item: FeedItem) => ReactNode }`. Tasks 9 and 10 fill these in.
  - Route `/space`.

- [ ] **Step 1: Write the failing tests**

`src/features/space/week.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { weekStartIso } from './week';

describe('weekStartIso', () => {
  it('is Monday 00:00 in Manila', () => {
    expect(weekStartIso('Asia/Manila', new Date('2026-10-08T04:00:00Z'))).toBe('2026-10-04T16:00:00.000Z');
  });
  it('keeps a Sunday night in the week that began on Monday', () => {
    expect(weekStartIso('Asia/Manila', new Date('2026-10-11T15:00:00Z'))).toBe('2026-10-04T16:00:00.000Z'); // Sun 23:00 Manila
  });
  it('follows daylight saving time', () => {
    expect(weekStartIso('America/New_York', new Date('2026-11-04T17:00:00Z'))).toBe('2026-11-02T05:00:00.000Z');
    expect(weekStartIso('America/New_York', new Date('2026-03-11T17:00:00Z'))).toBe('2026-03-09T04:00:00.000Z');
  });
});
```

`src/features/space/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { spaceBlocks, type SpaceStatsRow } from './stats';

const TZ = 'Asia/Manila';
const NOW = new Date('2026-10-08T04:00:00Z');
const row = (id: string, over: Partial<SpaceStatsRow> = {}): SpaceStatsRow => ({
  user_id: id, focus_seconds_total: 7200, focus_seconds_week: 3600, cards_total: 50, cards_week: 10, quizzes_total: 3,
  quizzes_week: 1, achievements: 2, current_streak: 4, longest_streak: 6, last_active_date: '2026-10-08', together_seconds_total: 1800, ...over,
});

describe('spaceBlocks', () => {
  it('a single member has no partner block', () => {
    const b = spaceBlocks([row('me')], { id: 'me', tz: TZ }, null, NOW);
    expect(b.partner).toBeNull();
    expect(b.me).toMatchObject({ streak: 4, weekSeconds: 3600, totalSeconds: 7200, cardsWeek: 10, achievements: 2 });
  });
  it('maps both members and the time spent together', () => {
    const b = spaceBlocks([row('me'), row('p', { focus_seconds_week: 60 })], { id: 'me', tz: TZ }, { id: 'p', tz: TZ }, NOW);
    expect(b.partner?.weekSeconds).toBe(60);
    expect(b.togetherSeconds).toBe(1800);
  });
  it('shows a lapsed streak as 0', () => {
    const b = spaceBlocks([row('me', { last_active_date: '2026-10-05' })], { id: 'me', tz: TZ }, null, NOW);
    expect(b.me?.streak).toBe(0);
  });
});
```

`src/features/space/feed.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { describeFeedItem, type FeedItem } from './feed';

const item = (over: Partial<FeedItem>): FeedItem => ({ kind: 'session', user_id: 'u', at: '2026-10-08T01:00:00Z', ref_id: 'r1', title: 'Biology', detail: {}, ...over });

describe('describeFeedItem', () => {
  it('describes sessions, marking ones studied together', () => {
    expect(describeFeedItem(item({ detail: { minutes: 25, together: true } }), 'You').text).toBe('You studied Biology for 25 min together ✦');
  });
  it('shows quiz accuracy only', () => {
    expect(describeFeedItem(item({ kind: 'quiz', title: 'Quiz', detail: { accuracy: 0.85 } }), 'Ana').text).toBe('Ana finished a quiz · 85%');
  });
  it('links shared items', () => {
    expect(describeFeedItem(item({ kind: 'shared_note', title: 'Cells' }), 'Ana')).toEqual({ text: 'Ana shared “Cells”', href: '/notes/r1' });
    expect(describeFeedItem(item({ kind: 'shared_deck', title: 'Verbs' }), 'Ana').href).toBe('/decks/r1');
  });
  it('names unlocked achievements', () => {
    expect(describeFeedItem(item({ kind: 'achievement', title: 'Binary Star', ref_id: null }), 'Ana').text).toBe('Ana unlocked Binary Star');
  });
});
```

`src/features/space/ourSky.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { layoutOurSky, type OurSession } from './ourSky';

const NOW = new Date('2026-10-08T12:00:00Z');
const s = (id: string, start: string, end: string, together = false): OurSession =>
  ({ id, subject_id: null, focus_seconds: 1500, started_at: start, ended_at: end, together });
const opts = (width: number) => ({ width, now: NOW, meColor: '#7CC4FF', partnerColor: '#FF9ECF' });

describe('layoutOurSky', () => {
  it('puts the two halves side by side on wide screens', () => {
    const l = layoutOurSky([s('a', '2026-10-08T01:00:00Z', '2026-10-08T01:30:00Z')], [s('b', '2026-10-08T02:00:00Z', '2026-10-08T02:30:00Z')], [], opts(1000));
    expect(l.row).toBe(true);
    expect(l.height).toBe(280);
    expect(l.stars.find((x) => x.id === 'b')!.x).toBeGreaterThanOrEqual(500);
  });
  it('stacks them on phones', () => {
    const l = layoutOurSky([s('a', '2026-10-08T01:00:00Z', '2026-10-08T01:30:00Z')], [s('b', '2026-10-08T02:00:00Z', '2026-10-08T02:30:00Z')], [], opts(375));
    expect(l.row).toBe(false);
    expect(l.height).toBe(400);
    expect(l.stars.find((x) => x.id === 'b')!.y).toBeGreaterThanOrEqual(200);
  });
  it('links only overlapping sessions that are both marked together', () => {
    const me = [s('a', '2026-10-08T01:00:00Z', '2026-10-08T01:30:00Z', true), s('c', '2026-10-08T05:00:00Z', '2026-10-08T05:30:00Z', true)];
    const partner = [s('b', '2026-10-08T01:10:00Z', '2026-10-08T01:40:00Z', true), s('d', '2026-10-08T05:00:00Z', '2026-10-08T05:30:00Z')];
    expect(layoutOurSky(me, partner, [], opts(1000)).links).toEqual([{ from: 'a', to: 'b' }]);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/features/space`
Expected: FAIL, "Cannot find module" for `./week`, `./stats`, `./feed`, `./ourSky`.

- [ ] **Step 3: Implement the pure modules**

`src/features/space/week.ts`:

```ts
import { getDay, parseISO, subDays } from 'date-fns';
import { todayInZone } from '@/features/gamification/streak';

/** Offset of `tz` from UTC at the instant `utcMs`, in ms (positive east of Greenwich). */
export function zoneOffsetMs(tz: string, utcMs: number): number {
  const parts: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  for (const p of fmt.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Monday 00:00 of the week containing `now`, in `tz`, as an ISO instant (the "this week" boundary). */
export function weekStartIso(tz: string, now: Date): string {
  const today = parseISO(todayInZone(tz, now));
  const monday = subDays(today, (getDay(today) + 6) % 7);
  const wall = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const firstGuess = wall - zoneOffsetMs(tz, wall);
  return new Date(wall - zoneOffsetMs(tz, firstGuess)).toISOString(); // second pass settles DST edges
}
```

`src/features/space/stats.ts`:

```ts
import { effectiveStreak, todayInZone } from '@/features/gamification/streak';

export interface SpaceStatsRow {
  user_id: string; focus_seconds_total: number; focus_seconds_week: number; cards_total: number; cards_week: number;
  quizzes_total: number; quizzes_week: number; achievements: number; current_streak: number; longest_streak: number;
  last_active_date: string | null; together_seconds_total: number;
}
export interface MemberBlock { userId: string; streak: number; weekSeconds: number; totalSeconds: number; cardsWeek: number; quizzesWeek: number; achievements: number }

const toBlock = (r: SpaceStatsRow, tz: string, now: Date): MemberBlock => ({
  userId: r.user_id, streak: effectiveStreak(r.current_streak, r.last_active_date, todayInZone(tz, now)),
  weekSeconds: r.focus_seconds_week, totalSeconds: r.focus_seconds_total, cardsWeek: r.cards_week, quizzesWeek: r.quizzes_week, achievements: r.achievements,
});

/** You / partner / together. The partner block is null until they have joined. */
export function spaceBlocks(rows: SpaceStatsRow[], me: { id: string; tz: string }, partner: { id: string; tz: string } | null, now: Date) {
  const mine = rows.find((r) => r.user_id === me.id);
  const theirs = partner ? rows.find((r) => r.user_id === partner.id) : undefined;
  return {
    me: mine ? toBlock(mine, me.tz, now) : null,
    partner: theirs && partner ? toBlock(theirs, partner.tz, now) : null,
    togetherSeconds: mine?.together_seconds_total ?? 0,
  };
}
```

`src/features/space/feed.ts`:

```ts
export interface FeedItem { kind: string; user_id: string; at: string; ref_id: string | null; title: string; detail: unknown }

export function describeFeedItem(item: FeedItem, who: string): { text: string; href: string | null } {
  const d = (item.detail ?? {}) as { minutes?: number; together?: boolean; accuracy?: number };
  switch (item.kind) {
    case 'session': return { text: `${who} studied ${item.title} for ${d.minutes ?? 0} min${d.together ? ' together ✦' : ''}`, href: null };
    case 'quiz': return { text: `${who} finished a quiz · ${Math.round((d.accuracy ?? 0) * 100)}%`, href: null };
    case 'achievement': return { text: `${who} unlocked ${item.title}`, href: null };
    case 'shared_note': return { text: `${who} shared “${item.title}”`, href: `/notes/${item.ref_id}` };
    case 'shared_deck': return { text: `${who} shared the deck “${item.title}”`, href: `/decks/${item.ref_id}` };
    default: return { text: `${who} was busy in the sky`, href: null };
  }
}
```

`src/features/space/ourSky.ts`:

```ts
import { layoutSky, type SkyLine, type SkySession, type SkyStar, type SkySubject } from '@/features/dashboard/sky';

export interface OurSession extends SkySession { ended_at: string }
export interface OurStar extends SkyStar { owner: 'me' | 'partner' }
export interface OurSkyLayout { width: number; height: number; row: boolean; stars: OurStar[]; lines: SkyLine[]; links: { from: string; to: string }[] }

const overlaps = (a: OurSession, b: OurSession) =>
  Date.parse(a.started_at) < Date.parse(b.ended_at) && Date.parse(b.started_at) < Date.parse(a.ended_at);

/** Two skies side by side (≥ 768 px) or stacked, joined by gold links where the two of you studied together. */
export function layoutOurSky(me: OurSession[], partner: OurSession[], subjects: SkySubject[],
  opts: { width: number; now: Date; meColor: string; partnerColor: string; maxStars?: number }): OurSkyLayout {
  const row = opts.width >= 768;
  const halfW = row ? Math.floor(opts.width / 2) : opts.width;
  const halfH = row ? 280 : 200;
  const mine = layoutSky(me, subjects, { width: halfW, height: halfH, now: opts.now, meColor: opts.meColor, maxStars: opts.maxStars });
  const theirs = layoutSky(partner, subjects, { width: halfW, height: halfH, now: opts.now, meColor: opts.partnerColor, maxStars: opts.maxStars });
  const dx = row ? halfW : 0;
  const dy = row ? 0 : halfH;
  const stars: OurStar[] = [
    ...mine.stars.map((s) => ({ ...s, owner: 'me' as const })),
    ...theirs.stars.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy, owner: 'partner' as const })),
  ];
  const shown = new Set(stars.map((s) => s.id));
  const links: { from: string; to: string }[] = [];
  for (const a of me) {
    if (!a.together || !shown.has(a.id)) continue;
    for (const b of partner) if (b.together && shown.has(b.id) && overlaps(a, b)) links.push({ from: a.id, to: b.id });
  }
  return { width: opts.width, height: row ? halfH : halfH * 2, row, stars, lines: [...mine.lines, ...theirs.lines], links };
}
```

`SkyLine` is already exported from `src/features/dashboard/sky.ts`; if it isn't, add `export` to its interface there.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/features/space`
Expected: PASS.

- [ ] **Step 5: Data hooks**

`src/features/space/api.ts`:

```ts
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TZ } from '@/features/gamification/streak';
import { useTableChange } from '@/features/realtime/useRealtime';
import { weekStartIso } from './week';

export const spaceKeys = { all: ['space'] as const, stats: (week: string) => ['space', 'stats', week] as const, feed: ['space', 'feed'] as const };

export function useSpaceStats() {
  const { profile } = useAuth();
  const [week] = useState(() => weekStartIso(profile?.timezone ?? DEFAULT_TZ, new Date()));
  return useQuery({
    queryKey: spaceKeys.stats(week),
    enabled: Boolean(profile),
    queryFn: async () => unwrap(await supabase.rpc('get_space_stats', { p_week_start: week })),
  });
}

export function useSpaceFeed() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: spaceKeys.feed,
    enabled: Boolean(profile),
    queryFn: async () => unwrap(await supabase.rpc('space_feed', { p_limit: 30 })),
  });
}

/** Mounted once: any study session change refreshes Our Space and the session lists. */
export function useSpaceSync() {
  const qc = useQueryClient();
  useTableChange('study_sessions', () => {
    void qc.invalidateQueries({ queryKey: spaceKeys.all });
    void qc.invalidateQueries({ queryKey: ['sessions'] });
  });
}
```

In `src/app/LiveSync.tsx`, import and call `useSpaceSync()`.

- [ ] **Step 6: Components and page**

`src/features/space/OurSky.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { startOfDay, subDays } from 'date-fns';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSessions } from '@/features/study/api';
import { useSubjects } from '@/features/subjects/api';
import { layoutOurSky } from './ourSky';

export function OurSky() {
  const { profile, partner } = useAuth();
  const [now] = useState(() => new Date());
  const [since] = useState(() => subDays(startOfDay(now), 365).toISOString());
  const mine = useSessions(since);
  const theirs = useSessions(since, partner?.id);
  const subjects = useSubjects();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!width || !profile || !partner) return null;
    const skySubjects = (subjects.data ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color, mastery: 0.5 }));
    return layoutOurSky(mine.data ?? [], theirs.data ?? [], skySubjects,
      { width, now, meColor: profile.star_color, partnerColor: partner.star_color, maxStars: 90 });
  }, [width, profile, partner, subjects.data, mine.data, theirs.data, now]);

  const byId = new Map(layout?.stars.map((s) => [s.id, s]) ?? []);
  const empty = !mine.isPending && !theirs.isPending && (mine.data?.length ?? 0) + (theirs.data?.length ?? 0) === 0;
  const partnerName = partner?.display_name || 'Your partner';

  return (
    <div ref={wrap} className="relative overflow-hidden rounded-3xl border border-line bg-surface">
      {layout && (
        <svg width={layout.width} height={layout.height} role="img"
          aria-label={`Our sky: ${mine.data?.length ?? 0} of your sessions, ${theirs.data?.length ?? 0} of ${partnerName}’s, ${layout.links.length} studied together`}>
          <line x1={layout.row ? layout.width / 2 : 0} y1={layout.row ? 0 : layout.height / 2} x2={layout.row ? layout.width / 2 : layout.width}
            y2={layout.row ? layout.height : layout.height / 2} stroke="var(--line)" strokeDasharray="3 6" />
          <text x={12} y={22} fontSize={12} fill="var(--ink-muted)">You</text>
          <text x={layout.row ? layout.width / 2 + 12 : 12} y={layout.row ? 22 : layout.height / 2 + 22} fontSize={12} fill="var(--ink-muted)">{partnerName}</text>
          {layout.lines.map((l, i) => {
            const a = byId.get(l.from); const b = byId.get(l.to);
            return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.color} strokeOpacity={l.opacity} strokeWidth={1} /> : null;
          })}
          {layout.links.map((l, i) => {
            const a = byId.get(l.from)!; const b = byId.get(l.to)!;
            return <path key={`${l.from}-${l.to}`} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} pathLength={1} strokeDasharray="1" stroke="var(--gold)" strokeWidth={1.5}
              className="animate-draw-line" style={{ animationDelay: `${400 + i * 60}ms`, filter: 'drop-shadow(0 0 4px var(--gold))' }} />;
          })}
          {layout.stars.map((s, i) => (
            <circle key={s.id} cx={s.x} cy={s.y} r={s.r + 0.6} fill={s.color} className="animate-pop-in"
              style={{ animationDelay: `${Math.min(i * 8, 800)}ms`, transformOrigin: `${s.x}px ${s.y}px`, filter: `drop-shadow(0 0 ${s.twinkle ? 6 : 3}px ${s.color})` }}>
              <title>{s.label}</title>
            </circle>
          ))}
        </svg>
      )}
      {!layout && <div className="h-[400px] md:h-[280px]" />}
      {empty && <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-ink-muted">Your first sessions light up this sky.</p>}
    </div>
  );
}
```

`src/features/space/StatBlocks.tsx`:

```tsx
import { useState } from 'react';
import { formatDuration } from '@/lib/dates';
import { useCountUp } from '@/lib/countUp';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Comet } from '@/components/sky/Comet';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSpaceStats } from './api';
import { spaceBlocks, type MemberBlock } from './stats';

function MemberCard({ title, block, achievementsLabel }: { title: string; block: MemberBlock | null; achievementsLabel: (n: number) => string }) {
  const week = useCountUp(block?.weekSeconds ?? 0, 900);
  const total = useCountUp(block?.totalSeconds ?? 0, 900);
  if (!block) return <Card><p className="text-sm text-ink-muted">{title}</p><p className="mt-2 text-sm">Not here yet.</p></Card>;
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{title}</p>
      <Comet streak={block.streak} size="sm" />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-muted">This week</dt><dd className="tabular">{formatDuration(week)}</dd>
        <dt className="text-ink-muted">All time</dt><dd className="tabular">{formatDuration(total)}</dd>
        <dt className="text-ink-muted">Cards this week</dt><dd className="tabular">{block.cardsWeek}</dd>
        <dt className="text-ink-muted">Achievements</dt><dd className="tabular">{achievementsLabel(block.achievements)}</dd>
      </dl>
    </Card>
  );
}

export function StatBlocks({ achievementsLabel = (n: number) => String(n) }: { achievementsLabel?: (n: number) => string }) {
  const { profile, partner } = useAuth();
  const stats = useSpaceStats();
  const [now] = useState(() => new Date());
  const b = profile
    ? spaceBlocks(stats.data ?? [], { id: profile.id, tz: profile.timezone }, partner ? { id: partner.id, tz: partner.timezone } : null, now)
    : null;
  const together = useCountUp(b?.togetherSeconds ?? 0, 900);
  if (stats.isPending || !b) return <Skeleton className="h-44" />;
  return (
    <div className="stagger grid gap-3 sm:grid-cols-3">
      <MemberCard title="You" block={b.me} achievementsLabel={achievementsLabel} />
      <MemberCard title={partner?.display_name || 'Your partner'} block={b.partner} achievementsLabel={achievementsLabel} />
      <Card className="flex flex-col justify-center gap-1 border-gold/30 bg-gold-soft/40">
        <p className="text-sm font-semibold">Together</p>
        <p className="font-display text-3xl tabular text-gold">{formatDuration(together)}</p>
        <p className="text-xs text-ink-muted">of focus side by side ✦</p>
      </Card>
    </div>
  );
}
```

`src/features/space/PartnerCard.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { PresenceDot } from '@/features/realtime/PartnerAvatar';
import { presenceLabel } from '@/features/realtime/presence';
import { usePartnerPresence } from '@/features/realtime/useRealtime';

export function PartnerCard({ actions }: { actions?: ReactNode }) {
  const { partner } = useAuth();
  const presence = usePartnerPresence();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="relative inline-flex"><Avatar profile={partner} size={56} /><PresenceDot presence={presence} className="size-4" /></span>
        <div className="min-w-0">
          <p className="truncate font-display text-xl">{partner?.display_name || 'Your partner'}</p>
          <p className="text-sm text-ink-muted">{presenceLabel(presence, now) ?? 'Offline'}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions}
        <Link to="/chat" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold hover:border-line-strong">
          <MessageCircle className="size-4" aria-hidden /> Message
        </Link>
      </div>
    </Card>
  );
}
```

`src/features/space/ActivityFeed.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { Award, BookOpen, FileText, Layers, ListChecks, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { WidgetCard } from '@/features/dashboard/widgets/WidgetCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSpaceFeed } from './api';
import { describeFeedItem, type FeedItem } from './feed';

const ICON: Record<string, LucideIcon> = { session: BookOpen, quiz: ListChecks, achievement: Award, shared_note: FileText, shared_deck: Layers };

export function ActivityFeed({ cheer }: { cheer?: (item: FeedItem) => ReactNode }) {
  const { user, partner } = useAuth();
  const feed = useSpaceFeed();
  const items = (feed.data ?? []) as FeedItem[];
  return (
    <WidgetCard title="Activity">
      {feed.isPending && <Skeleton className="h-40" />}
      {!feed.isPending && items.length === 0 && <p className="text-sm text-ink-muted">Nothing yet. Your sessions and shared notes will show up here.</p>}
      <ul className="stagger flex flex-col gap-2 [--stagger-step:30ms]">
        {items.map((it, i) => {
          const who = it.user_id === user?.id ? 'You' : partner?.display_name || 'Your partner';
          const { text, href } = describeFeedItem(it, who);
          const Icon = ICON[it.kind] ?? BookOpen;
          return (
            <li key={`${it.kind}-${it.ref_id ?? i}-${it.at}`} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-primary"><Icon className="size-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 text-sm">
                {href ? <Link to={href} className="hover:underline">{text}</Link> : text}
                <span className="block text-xs text-ink-faint">{formatDistanceToNowStrict(new Date(it.at), { addSuffix: true })}</span>
              </span>
              {it.user_id !== user?.id && cheer?.(it)}
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
```

`src/features/space/SpacePage.tsx`:

```tsx
import { Link } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/features/auth/AuthProvider';
import { ActivityFeed } from './ActivityFeed';
import { OurSky } from './OurSky';
import { PartnerCard } from './PartnerCard';
import { StatBlocks } from './StatBlocks';

export default function SpacePage() {
  const { partner } = useAuth();
  if (!partner) {
    return (
      <div>
        <PageHeader title="Our Space" />
        <EmptyState title="Our Space is made for two" body="Invite your partner to share a sky, study together and send shooting stars."
          action={<Link to="/settings/partner" className="text-primary underline">Invite your partner</Link>} />
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Our Space" subtitle="Two skies, one constellation." />
      <div className="stagger flex flex-col gap-4 lg:grid lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-12"><OurSky /></div>
        <div className="min-w-0 lg:col-span-12"><StatBlocks /></div>
        <div className="min-w-0 lg:col-span-5"><PartnerCard /></div>
        <div className="min-w-0 lg:col-span-7"><ActivityFeed /></div>
      </div>
    </div>
  );
}
```

In `src/app/routes.tsx`, replace the space placeholder with `r('space', () => import('@/features/space/SpacePage')),`.

- [ ] **Step 7: Typecheck, lint, test, commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.
- If `rpc('space_feed')` row types don't match `FeedItem`, keep the `as FeedItem[]` cast (the generated `detail` type is `Json`).

```bash
git add src/features/space src/app/routes.tsx src/app/LiveSync.tsx
git commit -m "feat(space): Our Space with both skies, stats, partner status and activity feed"
```

---

### Task 9: Shooting stars: dialog, overlay, cheers, chat button

**Files:**
- Create: `src/features/space/cheer.ts`
- Test: `src/features/space/cheer.test.ts`
- Create: `src/features/space/ShootingStarDialog.tsx`
- Create: `src/features/space/ShootingStarOverlay.tsx`
- Modify: `src/features/space/SpacePage.tsx`, `src/features/chat/ChatPage.tsx`, `src/app/AppShell.tsx`, `src/index.css`

**Interfaces:**
- **Consumes:**
  - From Task 6: `useOutbox().send({ kind: 'star', body })`, `STAR_MAX`.
  - From Task 3: `useTableChange('messages')`.
  - From Task 8: `PartnerCard({ actions })`, `ActivityFeed({ cheer })`, `FeedItem`.
  - From Task 7: `Composer({ extra })`.
  - Existing: `usePrefersReducedMotion()`.
- **Produces:**
  - `STAR_PRESETS`, `cheerFor(item)`
  - `ShootingStarButton({ variant: 'icon' | 'button' })`
  - `CheerButton({ item })`
  - `ShootingStarOverlay()`

- [ ] **Step 1: Write the failing test**

`src/features/space/cheer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STAR_MAX } from '@/features/chat/rules';
import { STAR_PRESETS, cheerFor } from './cheer';

describe('cheerFor', () => {
  it('picks a cheer for each kind of activity', () => {
    expect(cheerFor({ kind: 'session', title: 'Biology' })).toBe('🔥 Nice session!');
    expect(cheerFor({ kind: 'quiz', title: 'Quiz' })).toBe('👏 Great quiz!');
    expect(cheerFor({ kind: 'achievement', title: 'Binary Star' })).toBe('✦ Congrats on Binary Star!');
    expect(cheerFor({ kind: 'shared_note', title: 'Cells' })).toBe('💛 Thanks for sharing!');
  });
  it('always fits in a shooting star', () => {
    expect(cheerFor({ kind: 'achievement', title: 'x'.repeat(300) }).length).toBeLessThanOrEqual(STAR_MAX);
    for (const p of STAR_PRESETS) expect(p.length).toBeLessThanOrEqual(STAR_MAX);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/features/space/cheer.test.ts`
Expected: FAIL, "Cannot find module './cheer'".

- [ ] **Step 3: Implement `cheer.ts`**

```ts
import { STAR_MAX } from '@/features/chat/rules';

export const STAR_PRESETS = ['You’ve got this ✦', 'Proud of you', 'Water break?'] as const;

/** A preset shooting star for cheering one of the partner's feed items. */
export function cheerFor(item: { kind: string; title: string }): string {
  switch (item.kind) {
    case 'session': return '🔥 Nice session!';
    case 'quiz': return '👏 Great quiz!';
    case 'achievement': return `✦ Congrats on ${item.title}!`.slice(0, STAR_MAX);
    default: return '💛 Thanks for sharing!';
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/features/space/cheer.test.ts`
Expected: PASS.

- [ ] **Step 5: Dialog, button and cheer**

`src/features/space/ShootingStarDialog.tsx`:

```tsx
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOutbox } from '@/features/chat/api';
import { STAR_MAX } from '@/features/chat/rules';
import { STAR_PRESETS, cheerFor } from './cheer';
import type { FeedItem } from './feed';

function useSendStar() {
  const outbox = useOutbox();
  const [busy, setBusy] = useState(false);
  const send = async (body: string) => {
    const value = body.trim();
    if (!value || value.length > STAR_MAX) return false;
    setBusy(true);
    try {
      await outbox.send({ kind: 'star', body: value });
      toast.success('Shooting star sent ✦');
      return true;
    } catch (e) {
      toast.error(friendlyMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { send, busy };
}

export function ShootingStarDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { partner } = useAuth();
  const [text, setText] = useState('');
  const { send, busy } = useSendStar();
  const submit = async () => { if (await send(text)) { setText(''); onOpenChange(false); } };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm" title={`Send ${partner?.display_name || 'your partner'} a shooting star`}
      description="A little light across their screen."
      footer={<>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="gold" loading={busy} disabled={!text.trim()} onClick={() => void submit()}><Sparkles className="size-4" /> Send</Button>
      </>}>
      <div className="flex flex-wrap gap-2">
        {STAR_PRESETS.map((p) => (
          <button key={p} onClick={() => setText(p)} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm hover:border-gold">{p}</button>
        ))}
      </div>
      <Field label="Message" className="mt-3">
        {(id) => <Textarea id={id} maxLength={STAR_MAX} value={text} onChange={(e) => setText(e.target.value)} className="min-h-20" />}
      </Field>
      <p className="mt-1 text-right text-xs text-ink-faint tabular">{text.length}/{STAR_MAX}</p>
    </Dialog>
  );
}

export function ShootingStarButton({ variant = 'button' }: { variant?: 'icon' | 'button' }) {
  const [open, setOpen] = useState(false);
  return (<>
    {variant === 'icon'
      ? <button type="button" onClick={() => setOpen(true)} aria-label="Send a shooting star" className="grid size-10 shrink-0 place-items-center rounded-xl text-gold hover:bg-gold-soft"><Sparkles className="size-5" /></button>
      : <Button variant="gold" onClick={() => setOpen(true)}><Sparkles className="size-4" /> Send a shooting star</Button>}
    <ShootingStarDialog open={open} onOpenChange={setOpen} />
  </>);
}

export function CheerButton({ item }: { item: FeedItem }) {
  const { send, busy } = useSendStar();
  return (
    <button onClick={() => void send(cheerFor(item))} disabled={busy}
      className="shrink-0 rounded-full border border-gold/40 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold-soft disabled:opacity-50">
      Cheer
    </button>
  );
}
```

- [ ] **Step 6: The overlay**

Append to `src/index.css`, next to the other auth-sky rules:

```css
/* Shooting-star overlay (ShootingStarOverlay.tsx): a star crosses the screen while the message card fades in and out. */
.star-flight { animation: star-flight 2.5s var(--ease-soft) both; }
.star-card { animation: star-card 2.5s var(--ease-soft) both; }
@keyframes star-flight {
  from { transform: translate3d(-60vw, 12vh, 0) rotate(-8deg); opacity: 0; }
  15% { opacity: 1; }
  to { transform: translate3d(130vw, -8vh, 0) rotate(-8deg); opacity: 0; }
}
@keyframes star-card { 0% { opacity: 0; transform: translateY(8px); } 20%, 80% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-6px); } }
```

`src/features/space/ShootingStarOverlay.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePrefersReducedMotion } from '@/lib/motion';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTableChange } from '@/features/realtime/useRealtime';

interface Incoming { id: string; body: string }

/** The partner's shooting stars fly across the screen (≈ 2.5 s), then a toast offers a reply. Reduced motion: toast only. */
export function ShootingStarOverlay() {
  const { partner } = useAuth();
  const reduced = usePrefersReducedMotion();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Incoming[]>([]);
  const name = partner?.display_name || 'Your partner';
  const announce = (s: Incoming) => toast(`${name} sent you a shooting star ✦`, { description: s.body, action: { label: 'Reply', onClick: () => navigate('/chat') } });

  useTableChange('messages', (c) => {
    if (c.eventType !== 'INSERT') return;
    const m = c.new as { id: string; kind: string; sender_id: string; body: string };
    if (m.kind !== 'star' || m.sender_id !== partner?.id) return;
    if (reduced) { announce(m); return; }
    setQueue((q) => (q.some((x) => x.id === m.id) ? q : [...q, { id: m.id, body: m.body }]));
  });

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => { announce(current); setQueue((q) => q.slice(1)); }, 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one timer per star
  }, [current?.id]);

  if (!current) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <svg viewBox="0 0 220 40" className="star-flight absolute left-0 top-[16%] h-14 w-[45vw] min-w-56">
        <defs>
          <linearGradient id="star-tail" x1="0" x2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity=".9" />
          </linearGradient>
        </defs>
        <line x1="0" y1="20" x2="196" y2="20" stroke="url(#star-tail)" strokeWidth="3" strokeLinecap="round" />
        <path d="M206 6c.8 6 2.6 7.8 8.6 8.6-6 .8-7.8 2.6-8.6 8.6-.8-6-2.6-7.8-8.6-8.6 6-.8 7.8-2.6 8.6-8.6z" fill="var(--gold)" style={{ filter: 'drop-shadow(0 0 8px var(--gold))' }} />
      </svg>
      <div className="star-card absolute inset-x-0 top-1/3 mx-auto flex w-fit max-w-[min(90vw,28rem)] items-center gap-3 rounded-2xl border border-gold/40 bg-raised/90 px-4 py-3 shadow-glow backdrop-blur">
        <Avatar profile={partner} size={36} />
        <p className="text-sm">{current.body}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire it in**

- **`src/app/AppShell.tsx`:** import `ShootingStarOverlay` from `@/features/space/ShootingStarOverlay` and render it inside `<RealtimeProvider>`.
- **`src/features/space/SpacePage.tsx`:**
  1. Import `ShootingStarButton` and `CheerButton`.
  2. Change `<PartnerCard />` to `<PartnerCard actions={<ShootingStarButton />} />`.
  3. Change `<ActivityFeed />` to `<ActivityFeed cheer={(item) => <CheerButton item={item} />} />`.
- **`src/features/chat/ChatPage.tsx`:** import `ShootingStarButton` and change `<Composer onTyping={notifyTyping} />` to `<Composer onTyping={notifyTyping} extra={<ShootingStarButton variant="icon" />} />`.

- [ ] **Step 8: Typecheck, lint, test, commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

```bash
git add src/features/space src/features/chat/ChatPage.tsx src/app/AppShell.tsx src/index.css
git commit -m "feat(space): shooting stars with presets, cheers and a fly-across overlay"
```

---

### Task 10: Study together: shared orbit

**Files:**
- Create: `src/features/space/orbit.ts`
- Test: `src/features/space/orbit.test.ts`
- Create: `src/features/space/useOrbit.ts`
- Create: `src/features/space/StudyTogether.tsx`
- Modify:
  - `src/features/study/useStudySession.ts` and `src/features/study/useStudySession.test.ts`
  - `src/features/study/SessionSetup.tsx`, `src/features/study/api.ts`, `src/features/study/StudyPage.tsx`, `src/features/study/SessionRunner.tsx`, `src/features/study/SessionSummary.tsx`
  - `src/components/sky/OrbitTimer.tsx`
  - `src/features/space/SpacePage.tsx`, `src/app/AppShell.tsx`, `src/app/LiveSync.tsx`

**Interfaces:**
- **Consumes:**
  - From Task 3: `useRoomEvent('orbit')`, `useSendRoomEvent()`, `useConnection()`, `useSetMyStatus()`, `useOurRoom()`.
  - Existing: the study store `useStudySession()` (`start`, `dispatch`, `active`), the timer helpers, `saveStudySession`.
- **Produces:**
  - **`orbit.ts`:**
    - `Orbit { id; by; durationMs; status: 'running' | 'paused' | 'ended'; endsAt: number | null; remainingMs }`
    - `OrbitMessage`
    - `orbitReducer(o, m, receivedAt)`, `orbitRemaining(o, now)`, `isOver(o, now)`, `toSync(o, now)`, `parseOrbitMessage(p)`
  - **`useOrbit()`:** `{ orbit, start(durationMs): string, pause(), resume(), end() }`.
  - **`useOrbitSync()`.**
  - **`ActiveStudy`** gains `roomId: string | null; orbitId: string | null`.
  - **`saveStudySession`** takes `roomId`.

- [ ] **Step 1: Write the failing tests**

`src/features/space/orbit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isOver, orbitReducer, orbitRemaining, parseOrbitMessage, toSync, type Orbit } from './orbit';

const MIN = 60_000;
const start = (orbitId: string, receivedAt = 0, remainingMs = 25 * MIN) =>
  orbitReducer(null, { type: 'start', orbitId, by: 'ana', durationMs: 25 * MIN, remainingMs }, receivedAt)!;

describe('orbitReducer', () => {
  it('starts running, anchored on the receiver’s clock', () => {
    // the sender's clock is irrelevant: only remainingMs travels, and this device anchors it on receipt
    const o = start('o1', 5000, 10 * MIN);
    expect(o).toMatchObject({ id: 'o1', status: 'running', endsAt: 5000 + 10 * MIN });
    expect(orbitRemaining(o, 5000 + MIN)).toBe(9 * MIN);
  });
  it('pauses and resumes for both members', () => {
    const paused = orbitReducer(start('o1'), { type: 'pause', orbitId: 'o1', remainingMs: 5 * MIN }, 1000)!;
    expect(paused).toMatchObject({ status: 'paused', endsAt: null, remainingMs: 5 * MIN });
    expect(orbitRemaining(paused, 99 * MIN)).toBe(5 * MIN);
    const resumed = orbitReducer(paused, { type: 'resume', orbitId: 'o1', remainingMs: 5 * MIN }, 2000)!;
    expect(resumed).toMatchObject({ status: 'running', endsAt: 2000 + 5 * MIN });
  });
  it('ignores messages for an old orbit', () => {
    const o = start('o2');
    expect(orbitReducer(o, { type: 'pause', orbitId: 'o1', remainingMs: 0 }, 1)).toBe(o);
  });
  it('lets the lexicographically smaller id win simultaneous starts on both devices', () => {
    const onA = orbitReducer(start('b-orbit'), { type: 'start', orbitId: 'a-orbit', by: 'ben', durationMs: 25 * MIN, remainingMs: 25 * MIN }, 10)!;
    const onB = orbitReducer(start('a-orbit'), { type: 'start', orbitId: 'b-orbit', by: 'ana', durationMs: 25 * MIN, remainingMs: 25 * MIN }, 10)!;
    expect(onA.id).toBe('a-orbit');
    expect(onB.id).toBe('a-orbit');
  });
  it('lets a late joiner adopt the current state from a sync', () => {
    const synced = orbitReducer(null, { type: 'sync', orbitId: 'o1', by: 'ana', durationMs: 25 * MIN, status: 'paused', remainingMs: 7 * MIN }, 100)!;
    expect(synced).toMatchObject({ id: 'o1', status: 'paused', remainingMs: 7 * MIN });
  });
  it('ends, and counts a running orbit whose time is up as over', () => {
    const ended = orbitReducer(start('o1'), { type: 'end', orbitId: 'o1', remainingMs: 3 * MIN }, 50)!;
    expect(ended.status).toBe('ended');
    expect(isOver(ended, 0)).toBe(true);
    expect(isOver(start('o1', 0, MIN), MIN)).toBe(true);
    expect(isOver(start('o1', 0, MIN), MIN - 1)).toBe(false);
  });
  it('round-trips the current state through a sync message', () => {
    const o: Orbit = start('o1', 0, 10 * MIN);
    expect(toSync(o, MIN)).toEqual({ type: 'sync', orbitId: 'o1', by: 'ana', durationMs: 25 * MIN, status: 'running', remainingMs: 9 * MIN });
  });
});

describe('parseOrbitMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parseOrbitMessage({ type: 'hello' })).toEqual({ type: 'hello' });
    expect(parseOrbitMessage({ type: 'pause', orbitId: 'o1', remainingMs: 1000 })).toEqual({ type: 'pause', orbitId: 'o1', remainingMs: 1000 });
  });
  it('drops anything malformed or absurd', () => {
    expect(parseOrbitMessage(null)).toBeNull();
    expect(parseOrbitMessage({ type: 'start', orbitId: 'o1', by: 'a', durationMs: -1, remainingMs: 0 })).toBeNull();
    expect(parseOrbitMessage({ type: 'start', orbitId: 'o1', by: 'a', durationMs: 99 * 3_600_000, remainingMs: 0 })).toBeNull();
    expect(parseOrbitMessage({ type: 'sync', orbitId: 'o1', by: 'a', durationMs: 1, remainingMs: 1, status: 'exploded' })).toBeNull();
    expect(parseOrbitMessage({ type: 'launch' })).toBeNull();
  });
});
```

In `src/features/study/useStudySession.test.ts`:
1. Add `roomId: null, orbitId: null,` to the `active` fixture, after `taskDate`.
2. Add these tests inside `describe('parseStoredStudy', …)`:

```ts
  it('restores sessions saved before shared orbits existed as solo sessions', () => {
    const { roomId: _r, orbitId: _o, ...old } = active;
    expect(parseStoredStudy(JSON.stringify(old), start + HOUR)).toEqual(active);
  });
  it('keeps a shared-orbit session and drops a malformed orbit id', () => {
    const shared = { ...active, roomId: 'room-1', orbitId: 'orbit-1' };
    expect(parseStoredStudy(JSON.stringify(shared), start + HOUR)).toEqual(shared);
    expect(parseStoredStudy(JSON.stringify({ ...active, orbitId: 42 }), start)).toBeNull();
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/features/space/orbit.test.ts src/features/study/useStudySession.test.ts`
Expected:
- FAIL, "Cannot find module './orbit'".
- In `useStudySession.test.ts`: the new tests fail, and "restores a saved session exactly" fails because `roomId`/`orbitId` aren't kept yet.

- [ ] **Step 3: Implement `orbit.ts`**

```ts
export type OrbitStatus = 'running' | 'paused' | 'ended';
export interface Orbit { id: string; by: string; durationMs: number; status: OrbitStatus; endsAt: number | null; remainingMs: number }
export type OrbitMessage =
  | { type: 'hello' }
  | { type: 'start'; orbitId: string; by: string; durationMs: number; remainingMs: number }
  | { type: 'pause' | 'resume' | 'end'; orbitId: string; remainingMs: number }
  | { type: 'sync'; orbitId: string; by: string; durationMs: number; status: OrbitStatus; remainingMs: number };

const anchored = (status: OrbitStatus, remainingMs: number, receivedAt: number) =>
  ({ status, remainingMs, endsAt: status === 'running' ? receivedAt + remainingMs : null });

export const orbitRemaining = (o: Orbit, now: number) =>
  (o.status === 'running' && o.endsAt !== null ? Math.max(0, o.endsAt - now) : o.remainingMs);

export const isOver = (o: Orbit, now: number) => o.status === 'ended' || (o.status === 'running' && orbitRemaining(o, now) === 0);

/**
 * Applies a message (local or from the partner) received at `receivedAt` on this device's clock. Every message carries
 * the remaining time at send, so devices with different clocks agree. Stale orbit ids are ignored; of two simultaneous
 * starts the lexicographically smaller id wins on both sides.
 */
export function orbitReducer(o: Orbit | null, m: OrbitMessage, receivedAt: number): Orbit | null {
  switch (m.type) {
    case 'hello':
      return o;
    case 'start':
      if (o && o.status !== 'ended' && o.id <= m.orbitId) return o;
      return { id: m.orbitId, by: m.by, durationMs: m.durationMs, ...anchored('running', m.remainingMs, receivedAt) };
    case 'sync':
      if (o && o.status !== 'ended' && o.id < m.orbitId) return o;
      return { id: m.orbitId, by: m.by, durationMs: m.durationMs, ...anchored(m.status, m.remainingMs, receivedAt) };
    default: {
      if (!o || o.id !== m.orbitId || o.status === 'ended') return o;
      const status: OrbitStatus = m.type === 'pause' ? 'paused' : m.type === 'resume' ? 'running' : 'ended';
      return { ...o, ...anchored(status, m.type === 'end' ? 0 : m.remainingMs, receivedAt) };
    }
  }
}

export const toSync = (o: Orbit, now: number): OrbitMessage =>
  ({ type: 'sync', orbitId: o.id, by: o.by, durationMs: o.durationMs, status: o.status, remainingMs: orbitRemaining(o, now) });

const MAX_MS = 4 * 3_600_000;
const isMs = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_MS;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

/** Validates a broadcast payload from the partner; anything unexpected is dropped. */
export function parseOrbitMessage(p: unknown): OrbitMessage | null {
  if (!p || typeof p !== 'object') return null;
  const m = p as Record<string, unknown>;
  switch (m.type) {
    case 'hello':
      return { type: 'hello' };
    case 'start':
      return isId(m.orbitId) && isId(m.by) && isMs(m.durationMs) && isMs(m.remainingMs)
        ? { type: 'start', orbitId: m.orbitId, by: m.by, durationMs: m.durationMs, remainingMs: m.remainingMs } : null;
    case 'pause': case 'resume': case 'end':
      return isId(m.orbitId) && isMs(m.remainingMs) ? { type: m.type as 'pause' | 'resume' | 'end', orbitId: m.orbitId, remainingMs: m.remainingMs } : null;
    case 'sync':
      return isId(m.orbitId) && isId(m.by) && isMs(m.durationMs) && isMs(m.remainingMs) && (m.status === 'running' || m.status === 'paused' || m.status === 'ended')
        ? { type: 'sync', orbitId: m.orbitId, by: m.by, durationMs: m.durationMs, status: m.status, remainingMs: m.remainingMs } : null;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Add the room and orbit ids to the study store**

In `src/features/study/useStudySession.ts`:
1. Add `roomId: string | null;` and `orbitId: string | null;` to `ActiveStudy`, after `taskDate`.
2. In `parseStoredStudy`, replace the final `const ok = …` / `return …` with:

```ts
  // sessions saved before shared orbits existed have no room/orbit ids: they restore as solo sessions
  const roomId = a.roomId ?? null;
  const orbitId = a.orbitId ?? null;
  const ok = isTimer(a.timer) && typeof a.sessionId === 'string' && strOrNull(a.subjectId) && strOrNull(a.taskId) && strOrNull(a.taskDate) && strOrNull(a.endedAtIso)
    && strOrNull(roomId) && strOrNull(orbitId)
    && Boolean(counters) && ['cards', 'questions', 'correct'].every((k) => num(counters![k]))
    && (content === null || (Boolean(content) && CONTENT.has(content!.type as string) && typeof content!.id === 'string'))
    && Number.isFinite(started) && nowMs - started <= DAY;
  return ok ? ({ ...a, roomId, orbitId } as unknown as ActiveStudy) : null;
```

In `src/features/study/SessionSetup.tsx`, inside `start()`, add `roomId: null, orbitId: null,` to the object passed to `onStart({ … })`.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run src/features/space/orbit.test.ts src/features/study`
Expected: PASS.

- [ ] **Step 6: The orbit store and sync**

`useOrbitSync` relies on `useSendRoomEvent()` being stable (Task 3 builds `send` with `useCallback`). Without that, its "hello" would repeat on every presence change.

`src/features/space/useOrbit.ts`:

```ts
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useConnection, useRoomEvent, useSendRoomEvent } from '@/features/realtime/useRealtime';
import { orbitReducer, orbitRemaining, parseOrbitMessage, toSync, type Orbit, type OrbitMessage } from './orbit';

let current: Orbit | null = null;
const listeners = new Set<() => void>();
function set(next: Orbit | null) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The shared orbit (study-together timer) and the actions that change it for both members. */
export function useOrbit() {
  const orbit = useSyncExternalStore(subscribe, () => current, () => null);
  const send = useSendRoomEvent();
  const { user } = useAuth();
  const act = useCallback((m: OrbitMessage) => {
    set(orbitReducer(current, m, Date.now()));
    send('orbit', { ...m });
  }, [send]);
  const start = useCallback((durationMs: number) => {
    const orbitId = crypto.randomUUID();
    act({ type: 'start', orbitId, by: user!.id, durationMs, remainingMs: durationMs });
    return orbitId;
  }, [act, user]);
  const control = useCallback((type: 'pause' | 'resume' | 'end') => {
    if (current) act({ type, orbitId: current.id, remainingMs: orbitRemaining(current, Date.now()) });
  }, [act]);
  return { orbit, start, pause: () => control('pause'), resume: () => control('resume'), end: () => control('end') };
}

/** Mounted once: applies the partner's orbit messages, answers late joiners, and asks for the state after (re)connecting. */
export function useOrbitSync() {
  const send = useSendRoomEvent();
  const status = useConnection();
  useRoomEvent('orbit', (payload) => {
    const m = parseOrbitMessage(payload);
    if (!m) return;
    if (m.type === 'hello') {
      if (current && current.status !== 'ended') send('orbit', { ...toSync(current, Date.now()) });
      return;
    }
    set(orbitReducer(current, m, Date.now()));
  });
  useEffect(() => { if (status === 'live') send('orbit', { type: 'hello' }); }, [status, send]);
}
```

`src/features/space/StudyTogether.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Orbit as OrbitIcon, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useStudySession } from '@/features/study/useStudySession';
import { isOver } from './orbit';
import { useOrbit } from './useOrbit';

/** Our Space: start a shared orbit (focus length from your Study settings), or join the one that's running. */
export function StudyTogetherButton() {
  const { preferences } = useAuth();
  const { orbit, start } = useOrbit();
  const { active } = useStudySession();
  const navigate = useNavigate();
  if (orbit && !isOver(orbit, Date.now())) {
    return <Button onClick={() => navigate(`/study?orbit=${orbit.id}`)}><OrbitIcon className="size-4" /> Join the orbit</Button>;
  }
  return (
    <Button disabled={Boolean(active)} title={active ? 'Finish your current session first' : undefined}
      onClick={() => navigate(`/study?orbit=${start(preferences.study.focusMin * 60_000)}`)}>
      <Users className="size-4" /> Study together
    </Button>
  );
}

/** App-wide: "<partner> started a 25-min orbit — Join", until the orbit ends. */
export function OrbitInvite() {
  const { user, partner } = useAuth();
  const { orbit } = useOrbit();
  const { active } = useStudySession();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string | null>(null);
  const running = Boolean(orbit && !isOver(orbit, now));
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  if (!orbit || !running || orbit.by === user?.id || active?.orbitId === orbit.id || dismissed === orbit.id) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-md animate-rise-in items-center gap-3 rounded-2xl border border-gold/40 bg-raised p-3 shadow-glow md:bottom-6">
      <Avatar profile={partner} size={36} />
      <p className="min-w-0 flex-1 text-sm"><strong>{partner?.display_name || 'Your partner'}</strong> started a {Math.round(orbit.durationMs / 60_000)}-min orbit</p>
      <Link to={`/study?orbit=${orbit.id}`} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink">Join</Link>
      <button onClick={() => setDismissed(orbit.id)} aria-label="Dismiss" className="rounded-lg p-2 text-ink-faint hover:bg-surface-2"><X className="size-4" /></button>
    </div>
  );
}
```

The remaining wiring:
- **`src/app/LiveSync.tsx`:** call `useOrbitSync()`.
- **`src/app/AppShell.tsx`:** render `<OrbitInvite />` inside `<RealtimeProvider>`.
- **`src/features/space/SpacePage.tsx`:** import `StudyTogetherButton` from `./StudyTogether`, and change the partner card to `<PartnerCard actions={<><StudyTogetherButton /><ShootingStarButton /></>} />`.

- [ ] **Step 7: Study page, runner, timer and summary**

**`src/features/study/api.ts`:** add `roomId: string | null;` to the `saveStudySession` input, and `room_id: i.roomId,` to the insert.

**`src/components/sky/OrbitTimer.tsx`:**
1. Add the optional prop `companion?: ReactNode` (import `type ReactNode`).
2. Render it as the last child of the outer `div`:

```tsx
      {companion && (
        <div aria-hidden className="absolute inset-0 transition-transform duration-1000 ease-linear" style={{ transform: `rotate(${progress * 360 + 180}deg)` }}>
          <div className="absolute left-1/2 top-[10%] -translate-x-1/2 -translate-y-1/2" style={{ transform: `rotate(${-(progress * 360 + 180)}deg)` }}>{companion}</div>
        </div>
      )}
```

**`src/features/study/StudyPage.tsx`:**
1. Import `useEffect`, `useOrbit` from `@/features/space/useOrbit` and `useOurRoom` from `@/features/realtime/RealtimeProvider`.
2. After the existing hooks, add:

```tsx
  const orbitParam = params.get('orbit');
  const { orbit } = useOrbit();
  const room = useOurRoom().data ?? null;
  // Joining (or starting) a shared orbit opens a session whose timer follows it.
  useEffect(() => {
    if (!orbitParam || active || saved || !room || !orbit || orbit.id !== orbitParam || orbit.status === 'ended') return;
    start({
      config: { mode: 'custom', focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, customMin: Math.max(1, Math.ceil(orbit.durationMs / 60_000)) },
      subjectId: null, taskId: null, taskDate: null, content: null, roomId: room, orbitId: orbit.id,
    });
  }, [orbitParam, active, saved, room, orbit, start]);
```

3. In the final `return (<SessionSetup …/>)`, render this above the setup when `orbitParam` is set:

```tsx
<p className="mb-3 rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary">Looking for the shared orbit… If it has ended, start your own session below.</p>
```

Wrap both in a fragment.

**`src/features/study/SessionRunner.tsx`:**
1. Import `useEffect`/`useRef` (already there), `Avatar`, `useOrbit` from `@/features/space/useOrbit`, `isOver` and `orbitRemaining` from `@/features/space/orbit`, and `useSetMyStatus` from `@/features/realtime/useRealtime`. Read `partner` from `useAuth()`.
2. Replace the `remaining` line with:

```tsx
  const { partner } = useAuth();
  const { orbit, pause: pauseOrbit, resume: resumeOrbit, end: endOrbit } = useOrbit();
  const shared = active.orbitId && orbit?.id === active.orbitId ? orbit : null;
  const remaining = shared ? orbitRemaining(shared, now) : remainingMs(timer, now);
  const progress = shared ? 1 - orbitRemaining(shared, now) / shared.durationMs : phaseProgress(timer, now);
  const setMyStatus = useSetMyStatus();
  const finishRef = useRef(onFinish);
  useEffect(() => { finishRef.current = onFinish; });

  // The shared orbit drives the local timer: pauses and resumes follow it, and its end finishes the session.
  useEffect(() => {
    if (!shared) return;
    const t = Date.now();
    if (isOver(shared, t)) { finishRef.current(); return; }
    if (shared.status === 'paused' && timer.running) dispatch({ type: 'pause', now: t });
    if (shared.status === 'running' && !timer.running) dispatch({ type: 'resume', now: t });
  }, [shared, now, timer.running, dispatch]);

  // Presence: "Studying <subject> · n min left" for the partner.
  const subjectName = subject?.name ?? null;
  useEffect(() => {
    const t = Date.now();
    const left = shared ? orbitRemaining(shared, t) : remainingMs(timer, t);
    setMyStatus({ status: 'studying', subject: subjectName, endsAt: left === null ? null : t + left });
    return () => setMyStatus({ status: 'online' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on pause/phase changes, not every tick
  }, [subjectName, timer.phase, timer.running, shared?.status, setMyStatus]);
```

3. Change `const toggle = …` to:

```tsx
  const toggle = () => {
    if (shared) { if (shared.status === 'running') pauseOrbit(); else resumeOrbit(); return; }
    dispatch({ type: timer.running ? 'pause' : 'resume', now: Date.now() });
  };
```

4. In both dialogs' confirm buttons, call `if (shared) endOrbit();` before `onFinish();`.
5. Pass `progress={progress}` (instead of `phaseProgress(timer, now)`) and `companion={shared && partner ? <Avatar profile={partner} size={28} /> : undefined}` to `<OrbitTimer>`.
6. In the header, when `shared`, show under the subject line: `<p className="text-xs font-semibold text-gold">Studying together with {partner?.display_name || 'your partner'} ✦</p>`.

**`src/features/study/SessionSummary.tsx`:**
1. Pass `roomId: data.roomId` to `saveStudySession`.
2. Keep its result: `const row = await saveStudySession({ … });` then `setTogether(row.together);`, with `const [together, setTogether] = useState(false);`.
3. Add `['space']` to the invalidated keys.
4. Under the "A new star joins your sky" heading, render:

```tsx
{together && <p className="mt-2 inline-flex animate-pop-in items-center gap-1 rounded-full bg-gold-soft px-3 py-1 text-sm font-semibold text-gold">Studied together ✦</p>}
```

- [ ] **Step 8: Typecheck, lint, test, commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

```bash
git add src/features/space src/features/study src/components/sky/OrbitTimer.tsx src/app/AppShell.tsx src/app/LiveSync.tsx
git commit -m "feat(space): study together in a shared orbit that both members control"
```

---

### Task 11: Achievements grid and goals (profile, Our Space, dashboard)

**Files:**
- Create: `src/features/goals/progress.ts`
- Test: `src/features/goals/progress.test.ts`
- Create: `src/features/goals/api.ts`, `GoalCard.tsx`, `GoalDialog.tsx`, `GoalsList.tsx`
- Create: `src/features/gamification/AchievementsGrid.tsx`
- Create: `src/features/dashboard/widgets/CurrentGoals.tsx`
- Modify: `src/features/gamification/api.ts`, `src/features/profile/ProfilePage.tsx`, `src/features/space/SpacePage.tsx`, `src/features/dashboard/DashboardPage.tsx`

**Interfaces:**
- **Consumes:**
  - From Task 8: `useSpaceStats()` (rows with `user_id`, `focus_seconds_week`, `cards_week`, `quizzes_week`), `StatBlocks({ achievementsLabel })`.
  - Existing: `ProgressBar`, `Menu`, `ConfirmDialog`, `Dialog`, `Field`/`Input`/`Select`, `Switch`, `WidgetCard`.
- **Produces:**
  - **`progress.ts`:**
    - `GOAL_KINDS`, `GOAL_KIND_LABEL`, `type GoalKind`
    - `goalProgress(goal, weekly)`
    - `pickCurrentGoals(goals, progressOf, n = 3)`
    - `validateGoal(input)`
  - **`goals/api.ts`:** `useGoals()`, `useWeeklyTotals()`, `useSaveGoal()`, `useDeleteGoal()`, `useBumpGoal()`.
  - **`gamification/api.ts`:** `useAchievements(userId)`.

- [ ] **Step 1: Write the failing tests**

`src/features/goals/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { goalProgress, pickCurrentGoals, validateGoal, type GoalLike, type WeekTotals } from './progress';

const weekly = new Map<string, WeekTotals>([
  ['me', { focus_seconds_week: 3 * 3600, cards_week: 40, quizzes_week: 2 }],
  ['p', { focus_seconds_week: 3600, cards_week: 10, quizzes_week: 1 }],
]);
const goal = (over: Partial<GoalLike>): GoalLike => ({ owner_id: 'me', kind: 'weekly_minutes', target: 300, progress: 0, is_shared: false, due_date: null, completed_at: null, ...over });

describe('goalProgress', () => {
  it('counts only the owner for a personal weekly goal', () => {
    expect(goalProgress(goal({}), weekly)).toMatchObject({ value: 180, target: 300, done: false });
    expect(goalProgress(goal({ kind: 'weekly_cards', target: 40 }), weekly)).toMatchObject({ value: 40, done: true, ratio: 1 });
  });
  it('sums both members for a shared goal', () => {
    expect(goalProgress(goal({ is_shared: true, kind: 'weekly_quizzes', target: 5 }), weekly)).toMatchObject({ value: 3, ratio: 0.6 });
  });
  it('uses the stored progress for a custom goal, never below zero', () => {
    expect(goalProgress(goal({ kind: 'custom', target: 10, progress: 4 }), weekly)).toMatchObject({ value: 4, done: false });
    expect(goalProgress(goal({ kind: 'custom', target: 10, progress: -3 }), weekly).value).toBe(0);
  });
});

describe('pickCurrentGoals', () => {
  it('shows up to three unfinished goals, nearest due first, then least complete', () => {
    const goals = [
      { ...goal({ kind: 'custom', target: 10, progress: 9 }), id: 'nearly' },
      { ...goal({ kind: 'custom', target: 10, progress: 1 }), id: 'barely' },
      { ...goal({ kind: 'custom', target: 10, progress: 5, due_date: '2026-10-20' }), id: 'due-later' },
      { ...goal({ kind: 'custom', target: 10, progress: 5, due_date: '2026-10-10' }), id: 'due-soon' },
      { ...goal({ kind: 'custom', target: 10, progress: 10 }), id: 'done' },
    ];
    expect(pickCurrentGoals(goals, (g) => goalProgress(g, weekly)).map((g) => g.id)).toEqual(['due-soon', 'due-later', 'barely']);
  });
});

describe('validateGoal', () => {
  it('needs a name and a whole-number target', () => {
    expect(validateGoal({ title: '  ', kind: 'custom', target: 1, is_shared: false, due_date: null })).toMatchObject({ ok: false, errors: { title: expect.any(String) } });
    expect(validateGoal({ title: 'Read', kind: 'custom', target: 1.5, is_shared: false, due_date: null })).toMatchObject({ ok: false, errors: { target: expect.any(String) } });
  });
  it('trims the name and only keeps a due date on custom goals', () => {
    expect(validateGoal({ title: ' 5 hours ', kind: 'weekly_minutes', target: 300, is_shared: true, due_date: '2026-10-20' }))
      .toEqual({ ok: true, value: { title: '5 hours', kind: 'weekly_minutes', target: 300, is_shared: true, due_date: null } });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/features/goals`
Expected: FAIL, "Cannot find module './progress'".

- [ ] **Step 3: Implement `progress.ts`**

```ts
export const GOAL_KINDS = ['weekly_minutes', 'weekly_cards', 'weekly_quizzes', 'custom'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  weekly_minutes: 'Minutes this week', weekly_cards: 'Cards this week', weekly_quizzes: 'Quizzes this week', custom: 'Custom',
};

export interface GoalLike { owner_id: string; kind: string; target: number; progress: number; is_shared: boolean; due_date: string | null; completed_at: string | null }
export interface WeekTotals { focus_seconds_week: number; cards_week: number; quizzes_week: number }

/** Weekly goals read this week's totals (shared goals sum both members); custom goals use their stored progress. */
export function goalProgress(g: GoalLike, weekly: Map<string, WeekTotals>) {
  const of = (r?: WeekTotals) => (!r ? 0
    : g.kind === 'weekly_minutes' ? Math.floor(r.focus_seconds_week / 60)
      : g.kind === 'weekly_cards' ? r.cards_week : r.quizzes_week);
  const value = g.kind === 'custom' ? Math.max(0, g.progress)
    : g.is_shared ? [...weekly.values()].reduce((s, r) => s + of(r), 0) : of(weekly.get(g.owner_id));
  return { value, target: g.target, ratio: g.target > 0 ? Math.min(1, value / g.target) : 0, done: value >= g.target };
}

/** Dashboard: up to `n` unfinished goals, nearest due date first, then least complete. */
export function pickCurrentGoals<T extends GoalLike>(goals: T[], progressOf: (g: T) => { ratio: number; done: boolean }, n = 3): T[] {
  return goals
    .map((g) => ({ g, p: progressOf(g) }))
    .filter(({ p }) => !p.done)
    .sort((a, b) => {
      const da = a.g.due_date ?? '9999-12-31';
      const db = b.g.due_date ?? '9999-12-31';
      return da === db ? a.p.ratio - b.p.ratio : da.localeCompare(db);
    })
    .slice(0, n)
    .map(({ g }) => g);
}

export interface GoalInput { title: string; kind: GoalKind; target: number; is_shared: boolean; due_date: string | null }

export function validateGoal(i: { title: string; kind: string; target: number; is_shared: boolean; due_date: string | null }):
  | { ok: true; value: GoalInput } | { ok: false; errors: Partial<Record<'title' | 'kind' | 'target', string>> } {
  const errors: Partial<Record<'title' | 'kind' | 'target', string>> = {};
  const title = i.title.trim();
  if (title.length < 1 || title.length > 120) errors.title = 'Give the goal a name (up to 120 characters).';
  if (!(GOAL_KINDS as readonly string[]).includes(i.kind)) errors.kind = 'Pick a kind of goal.';
  if (!Number.isInteger(i.target) || i.target < 1 || i.target > 100_000) errors.target = 'Use a whole number from 1 to 100,000.';
  if (Object.keys(errors).length) return { ok: false, errors };
  const kind = i.kind as GoalKind;
  return { ok: true, value: { title, kind, target: i.target, is_shared: i.is_shared, due_date: kind === 'custom' ? i.due_date : null } };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/features/goals`
Expected: PASS.

- [ ] **Step 5: Data hooks**

`src/features/goals/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSpaceStats } from '@/features/space/api';
import type { GoalInput, WeekTotals } from './progress';

export type Goal = Tables<'study_goals'>;
export const goalKeys = { all: ['goals'] as const };

/** Your goals plus your partner's shared ones (RLS). */
export function useGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: goalKeys.all,
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('study_goals').select('*').order('created_at')),
  });
}

export function useWeeklyTotals(): Map<string, WeekTotals> {
  return new Map((useSpaceStats().data ?? []).map((r) => [r.user_id, r]));
}

export function useSaveGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...input }: GoalInput & { id?: string }) => {
      if (id) assertOk(await supabase.from('study_goals').update(input).eq('id', id));
      else assertOk(await supabase.from('study_goals').insert({ owner_id: user!.id, ...input }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('study_goals').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

/** − / + on a custom goal; the first time it reaches its target, completed_at is set (and kept). */
export function useBumpGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goal, delta }: { goal: Goal; delta: number }) => {
      const progress = Math.max(0, goal.progress + delta);
      const completed_at = goal.completed_at ?? (progress >= goal.target ? new Date().toISOString() : null);
      assertOk(await supabase.from('study_goals').update({ progress, completed_at }).eq('id', goal.id));
    },
    onMutate: ({ goal, delta }) => qc.setQueryData<Goal[]>(goalKeys.all, (l) => l?.map((g) => (g.id === goal.id ? { ...g, progress: Math.max(0, g.progress + delta) } : g))),
    onSettled: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}
```

Add to `src/features/gamification/api.ts`:

```ts
export function useAchievements(userId: string | undefined) {
  const catalog = useQuery({
    queryKey: ['achievements'],
    staleTime: Infinity,
    queryFn: async () => unwrap(await supabase.from('achievements').select('*').order('sort')),
  });
  const unlocked = useQuery({
    queryKey: ['achievements', 'unlocked', userId],
    enabled: Boolean(userId),
    queryFn: async () => unwrap(await supabase.from('user_achievements').select('achievement_code, unlocked_at').eq('user_id', userId!)),
  });
  return {
    all: catalog.data ?? [],
    unlocked: new Map((unlocked.data ?? []).map((u) => [u.achievement_code, u.unlocked_at])),
    isPending: catalog.isPending || (Boolean(userId) && unlocked.isPending),
  };
}
```

- [ ] **Step 6: Components**

`src/features/gamification/AchievementsGrid.tsx`:

```tsx
import { format } from 'date-fns';
import { Award, Heart, Moon, MoonStar, Orbit, Sparkle, Sparkles, Sun, Telescope, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAchievements } from './api';

const ICONS: Record<string, LucideIcon> = {
  sparkle: Sparkle, zap: Zap, stars: Sparkles, orbit: Orbit, moon: Moon, sun: Sun, telescope: Telescope, trophy: Trophy, 'moon-star': MoonStar, heart: Heart,
};

export function AchievementsGrid({ userId }: { userId: string }) {
  const { all, unlocked, isPending } = useAchievements(userId);
  if (isPending) return <Skeleton className="h-40" />;
  return (
    <section aria-label="Achievements">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg">Achievements</h2>
        <p className="text-sm text-ink-muted tabular">{unlocked.size} / {all.length} unlocked</p>
      </div>
      <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {all.map((a) => {
          const at = unlocked.get(a.code);
          const Icon = ICONS[a.icon] ?? Award;
          return (
            <li key={a.code} className={cn('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center', at ? 'border-gold/40 bg-gold-soft' : 'border-dashed border-line-strong')}>
              <span className={cn('grid size-11 place-items-center rounded-full', at ? 'bg-gold text-primary-ink shadow-[0_0_16px_var(--gold)]' : 'bg-surface-2 text-ink-faint')}>
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="text-xs text-ink-muted">{at ? `Unlocked ${format(new Date(at), 'MMM d, yyyy')}` : a.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

`src/features/goals/GoalDialog.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSaveGoal, type Goal } from './api';
import { GOAL_KINDS, GOAL_KIND_LABEL, validateGoal, type GoalKind } from './progress';

const TARGET_LABEL: Record<GoalKind, string> = {
  weekly_minutes: 'Target (minutes per week)', weekly_cards: 'Target (cards per week)', weekly_quizzes: 'Target (quizzes per week)', custom: 'Target',
};

export function GoalDialog({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (o: boolean) => void; goal?: Goal }) {
  const { preferences } = useAuth();
  const save = useSaveGoal();
  const [form, setForm] = useState(() => goal
    ? { title: goal.title, kind: goal.kind, target: goal.target, is_shared: goal.is_shared, due_date: goal.due_date }
    : { title: '', kind: 'weekly_minutes', target: 300, is_shared: preferences.privacy.shareByDefault, due_date: null as string | null });
  const [errors, setErrors] = useState<Partial<Record<'title' | 'kind' | 'target', string>>>({});

  async function submit() {
    const v = validateGoal(form);
    if (!v.ok) { setErrors(v.errors); return; }
    await save.mutateAsync({ id: goal?.id, ...v.value });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={goal ? 'Edit goal' : 'New goal'}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={save.isPending} onClick={() => void submit()}>Save goal</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Goal" error={errors.title}>
          {(id) => <Input id={id} maxLength={120} value={form.title} placeholder="Study 5 hours this week" invalid={Boolean(errors.title)} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
        </Field>
        <Field label="Kind" error={errors.kind}>
          {(id) => (
            <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {GOAL_KINDS.map((k) => <option key={k} value={k}>{GOAL_KIND_LABEL[k]}</option>)}
            </Select>
          )}
        </Field>
        <Field label={TARGET_LABEL[form.kind as GoalKind] ?? 'Target'} error={errors.target}>
          {(id) => <Input id={id} type="number" min={1} step={1} inputMode="numeric" value={form.target} invalid={Boolean(errors.target)} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} />}
        </Field>
        {form.kind === 'custom' && (
          <Field label="Due date (optional)">
            {(id) => <Input id={id} type="date" value={form.due_date ?? ''} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} />}
          </Field>
        )}
        <Switch label="Shared goal" hint="Counts both of you and shows in Our Space." checked={form.is_shared} onCheckedChange={(v) => setForm({ ...form, is_shared: v })} />
      </div>
    </Dialog>
  );
}
```

`src/features/goals/GoalCard.tsx`:

```tsx
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Minus, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Menu } from '@/components/ui/Menu';
import { ProgressBar } from '@/components/ui/Progress';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBumpGoal, useDeleteGoal, type Goal } from './api';
import { GOAL_KIND_LABEL, goalProgress, type GoalKind, type WeekTotals } from './progress';

export function GoalCard({ goal, weekly, onEdit }: { goal: Goal; weekly: Map<string, WeekTotals>; onEdit: () => void }) {
  const { user, partner } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const bump = useBumpGoal();
  const del = useDeleteGoal();
  const p = goalProgress(goal, weekly);
  const mine = goal.owner_id === user?.id;
  const meta = [GOAL_KIND_LABEL[goal.kind as GoalKind] ?? goal.kind, goal.is_shared && 'shared', !mine && (partner?.display_name || 'your partner'),
    goal.due_date && `due ${format(parseISO(goal.due_date), 'MMM d')}`].filter(Boolean).join(' · ');
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate font-semibold">{goal.title}</p><p className="text-xs text-ink-muted">{meta}</p></div>
        {mine && (
          <Menu trigger={<button className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-2" aria-label="Goal options"><MoreHorizontal className="size-4" /></button>}
            items={[{ label: 'Edit', icon: Pencil, onSelect: onEdit }, { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirming(true) }]} />
        )}
      </div>
      <ProgressBar value={p.ratio} tone={p.done ? 'gold' : 'primary'} label={`${goal.title}: ${p.value} of ${p.target}`} />
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="tabular">{p.value} / {p.target}</span>
        {p.done && <span className="inline-flex animate-pop-in items-center gap-1 font-semibold text-gold"><Sparkles className="size-4" aria-hidden />{goal.kind === 'custom' ? 'Completed ✓' : 'Done this week ✓'}</span>}
        {goal.kind === 'custom' && mine && (
          <span className="flex gap-1">
            <Button size="icon" variant="secondary" aria-label="One less" disabled={goal.progress <= 0} onClick={() => bump.mutate({ goal, delta: -1 })}><Minus className="size-4" /></Button>
            <Button size="icon" variant="secondary" aria-label="One more" onClick={() => bump.mutate({ goal, delta: 1 })}><Plus className="size-4" /></Button>
          </span>
        )}
      </div>
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title="Delete this goal?" body={`“${goal.title}” will be removed.`} confirmLabel="Delete" danger
        onConfirm={() => del.mutateAsync(goal.id)} />
    </Card>
  );
}
```

`src/features/goals/GoalsList.tsx`:

```tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGoals, useWeeklyTotals, type Goal } from './api';
import { GoalCard } from './GoalCard';
import { GoalDialog } from './GoalDialog';

export function GoalsList({ title, filter, canCreate = false }: { title: string; filter: (g: Goal) => boolean; canCreate?: boolean }) {
  const goals = useGoals();
  const weekly = useWeeklyTotals();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [open, setOpen] = useState(false);
  const list = (goals.data ?? []).filter(filter);
  const openFor = (g: Goal | null) => { setEditing(g); setOpen(true); };
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg">{title}</h2>
        {canCreate && <Button size="sm" variant="secondary" onClick={() => openFor(null)}><Plus className="size-4" /> New goal</Button>}
      </div>
      {goals.isPending ? <Skeleton className="h-24" />
        : list.length === 0 ? <p className="text-sm text-ink-muted">{canCreate ? 'No goals yet. Set one to aim for this week.' : 'No goals here yet.'}</p>
          : <div className="stagger grid gap-3 sm:grid-cols-2">{list.map((g) => <GoalCard key={g.id} goal={g} weekly={weekly} onEdit={() => openFor(g)} />)}</div>}
      {open && <GoalDialog key={editing?.id ?? 'new'} open={open} onOpenChange={setOpen} goal={editing ?? undefined} />}
    </section>
  );
}
```

`src/features/dashboard/widgets/CurrentGoals.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGoals, useWeeklyTotals } from '@/features/goals/api';
import { GoalDialog } from '@/features/goals/GoalDialog';
import { goalProgress, pickCurrentGoals } from '@/features/goals/progress';
import { WidgetCard } from './WidgetCard';

export function CurrentGoals() {
  const { user } = useAuth();
  const goals = useGoals();
  const weekly = useWeeklyTotals();
  const [open, setOpen] = useState(false);
  const picked = pickCurrentGoals((goals.data ?? []).filter((g) => g.owner_id === user?.id || g.is_shared), (g) => goalProgress(g, weekly));
  return (
    <WidgetCard title="Current goals" more={{ to: '/profile', label: 'All goals' }}>
      {goals.isPending ? <Skeleton className="h-24" /> : picked.length === 0 ? (
        <div className="flex flex-col items-start gap-2 text-sm text-ink-muted">
          No goals in progress.
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Set a goal</Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {picked.map((g) => {
            const p = goalProgress(g, weekly);
            return (
              <li key={g.id}>
                <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{g.title}</span><span className="tabular text-ink-muted">{p.value}/{p.target}</span></div>
                <ProgressBar value={p.ratio} label={`${g.title}: ${p.value} of ${p.target}`} />
              </li>
            );
          })}
        </ul>
      )}
      {open && <GoalDialog open={open} onOpenChange={setOpen} />}
    </WidgetCard>
  );
}
```

- [ ] **Step 7: Put them on the pages**

**`src/features/profile/ProfilePage.tsx`:** import `AchievementsGrid` from `@/features/gamification/AchievementsGrid` and `GoalsList` from `@/features/goals/GoalsList`. After the Subjects card, add:

```tsx
      <Card className="mt-4"><AchievementsGrid userId={p.id} /></Card>
      <Card className="mt-4">
        {isSelf
          ? <GoalsList title="Goals" filter={(g) => g.owner_id === p.id} canCreate />
          : <GoalsList title="Shared goals" filter={(g) => g.owner_id === p.id && g.is_shared} />}
      </Card>
```

**`src/features/space/SpacePage.tsx`:**
1. Import `Card` from `@/components/ui/Card`, `GoalsList` from `@/features/goals/GoalsList` and `useAchievements` from `@/features/gamification/api`.
2. Add `<div className="min-w-0 lg:col-span-12"><Card><GoalsList title="Shared goals" filter={(g) => g.is_shared} canCreate /></Card></div>` after the activity feed.
3. Pass the x / y label to the stat blocks, calling the hook at the top of `SpacePage` before the `!partner` early return:

```tsx
const { all } = useAchievements(undefined);
…
<StatBlocks achievementsLabel={(n) => `${n} / ${all.length}`} />
```

**`src/features/dashboard/DashboardPage.tsx`:** import `CurrentGoals`, change `<Slot span="lg:col-span-12"><SubjectProgress /></Slot>` to `lg:col-span-7`, and add `<Slot span="lg:col-span-5"><CurrentGoals /></Slot>` right after it.

- [ ] **Step 8: Typecheck, lint, test, commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

```bash
git add src/features/goals src/features/gamification src/features/dashboard src/features/profile/ProfilePage.tsx src/features/space/SpacePage.tsx
git commit -m "feat(goals): achievements grid, personal and shared goals, and a Current goals widget"
```

---

### Task 12: Navigation clean-up (Market and "soon" removed) and final verification

**Files:**
- Modify: `src/app/nav.ts`, `src/app/nav.test.ts`, `src/app/routes.tsx`, `src/app/routes.test.ts`, `src/app/Sidebar.tsx`, `src/app/MoreSheet.tsx`, `src/app/Placeholder.tsx`

**Interfaces:**
- **Consumes:** every earlier task.
- **Produces:**
  - **`NavItem`** is `{ to; label; icon }`, with no `phase`.
  - **`/market`** resolves to the 404 route.
  - **`Placeholder`** requires `body`.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/nav.test.ts`, inside `describe('nav', …)`:

```ts
  it('has no Market and no "soon" items', () => {
    expect(NAV.map((n) => n.to)).not.toContain('/market');
    expect(NAV.some((n) => 'phase' in n)).toBe(false);
  });
```

Add to `src/app/routes.test.ts`, inside the `describe`:

```ts
  it('Market is gone: /market falls through to the 404 page', () => {
    expect(leaf('/market').path).toBe('*');
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/app/nav.test.ts src/app/routes.test.ts`
Expected: FAIL. NAV still contains `/market`, and the `/market` leaf path is `market`.

- [ ] **Step 3: Remove Market and the phase flag**

`src/app/nav.ts`:

```ts
import { BarChart3, BookOpenText, CalendarDays, Heart, Home, Layers, ListChecks, MessagesSquare, Settings, Sparkles, Timer, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon }

export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/notes', label: 'Notes', icon: BookOpenText },
  { to: '/decks', label: 'Flashcards', icon: Layers },
  { to: '/quizzes', label: 'Quizzes', icon: ListChecks },
  { to: '/tutor', label: 'Nova', icon: Sparkles },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/study', label: 'Study', icon: Timer },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/space', label: 'Our Space', icon: Heart },
  { to: '/chat', label: 'Chat', icon: MessagesSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const byPath = (p: string) => NAV.find((n) => n.to === p)!;
export const MOBILE_TABS: NavItem[] = ['/', '/notes', '/study', '/tutor', '/space'].map(byPath);
export const MORE_ITEMS: NavItem[] = NAV.filter((n) => !MOBILE_TABS.includes(n));
```

Then the call sites:
- **`src/app/Sidebar.tsx`:** change `NAV.map(({ to, label, icon: Icon, phase }) => (` to `NAV.map(({ to, label, icon: Icon }) => (`, and delete the line `{!collapsed && phase === 2 && <Badge>soon</Badge>}`.
- **`src/app/MoreSheet.tsx`:** change `MORE_ITEMS.map(({ to, label, icon: Icon, phase }) => (` to `MORE_ITEMS.map(({ to, label, icon: Icon }) => (`, and delete `{phase === 2 && <Badge>soon</Badge>}`.
- **`src/app/routes.tsx`:** delete `{ path: 'market', element: <Placeholder title="Market" /> },`. Only the `'*'` route still uses `Placeholder`.
- **`src/app/Placeholder.tsx`:** make `body` required and drop the Phase 2 default:

```tsx
import { EmptyState } from '@/components/ui/EmptyState';
export function Placeholder({ title, body }: { title: string; body: string }) {
  return <div className="py-10"><EmptyState title={title} body={body} /></div>;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/app`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run each command and read its output:
- `npm test`: all files pass.
- `npm run typecheck`
- `npm run lint`
- `npm run build`: "built in …".
- `npm run check:bundle`: "✓ dist/ contains no AI keys…".
- `grep -rn "soon\|Market\|/market" src --include=*.tsx --include=*.ts`: no navigation, route or badge hits remain. The tutor "markets crash" prompt and the generated DB types are fine.

- [ ] **Step 6: Database checks and advisors**

- **Checks:** run `supabase/tests/rls_checks.sql` with `execute_sql` (2 members).
  - Expected: `RLS CHECKS PASSED`.
- **Advisors:** run the Supabase MCP `get_advisors` tool (type `security`).
  - Expected: only the intentional findings from spec §8 (`rls_enabled_no_policy` on `ai_requests`/`allowed_emails`; `authenticated_security_definer_function_executable` for the listed member RPCs, including `get_space_stats`, `space_feed`, `refresh_reminders`).
  - Report anything else.

- [ ] **Step 7: Visual pass**

**If smoke credentials exist:**

```bash
MSYS_NO_PATHCONV=1 SHOOT_WAIT=1500 node scripts/shoot.mjs / /space /chat /notifications /settings/notifications /settings/privacy /profile
MSYS_NO_PATHCONV=1 SHOOT_REDUCED=1 node scripts/shoot.mjs /space
```

Read every PNG in `.shots/`:
- Expected: no "⚠ horizontal overflow" and no console errors.
- Layouts hold at 375 px and desktop in Night and Daybreak.

**Otherwise:** list these screens in the report as needing the manual pass.

- [ ] **Step 8: Manual two-browser check (needs both accounts; hand this list to the user)**

Sign in as each member in two browsers (or one normal and one private window), then confirm:
1. **Chat:** a message appears for the other member within ~1 s.
2. **Reactions:** a reaction shows on both sides, and so does deleting a message ("message deleted"). Search finds an older message and jumps to it.
3. **Typing:** "<name> is typing…" appears while typing and disappears after ~4 s.
4. **Shooting star:** sending one makes it fly across the other screen, then a toast with Reply appears.
5. **Studying together:** "Study together" shows "<name> started a 25-min orbit — Join" on the other side.
   - After joining, pause/resume on either side applies to both.
   - After 10+ minutes together, finishing shows "Studied together ✦".
   - Our Space draws a gold link, and Binary Star is unlocked for both.
6. **Notifications:** the bell count rises for a new message while the chat is closed; opening the chat clears it.
7. **Presence:** the dot is green while online and gold while studying; turning off "Show when I'm online" hides it.
8. **Market:** it's gone from the menu and the More sheet, and `/market` shows "Lost in space".

- [ ] **Step 9: Commit**

```bash
git add src/app
git commit -m "feat(nav): remove Market and every \"soon\" badge now that Phase 2 is live"
```
