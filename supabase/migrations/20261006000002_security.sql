-- supabase/migrations/20261006000002_security.sql
grant usage on schema private to authenticated;

create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;

create or replace function private.partner_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles where id <> (select auth.uid()) limit 1;
$$;

create or replace function private.can_view_note(p_note uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes n where n.id = p_note
    and (n.owner_id = (select auth.uid()) or (n.is_shared and private.is_member())));
$$;
create or replace function private.can_view_deck(p_deck uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.decks d where d.id = p_deck
    and (d.owner_id = (select auth.uid()) or (d.is_shared and private.is_member())));
$$;
create or replace function private.can_view_quiz(p_quiz uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quizzes q where q.id = p_quiz
    and (q.owner_id = (select auth.uid()) or (q.is_shared and private.is_member())));
$$;
create or replace function private.owns_note(p_note uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes where id = p_note and owner_id = (select auth.uid()));
$$;
create or replace function private.owns_deck(p_deck uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.decks where id = p_deck and owner_id = (select auth.uid()));
$$;
create or replace function private.owns_quiz(p_quiz uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quizzes where id = p_quiz and owner_id = (select auth.uid()));
$$;
create or replace function private.deck_from_path(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 2)::uuid end;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ───────────── Signup guard + profile creation
create or replace function private.guard_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'StudySpace is private — this email is not on the guest list.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, left(split_part(new.email, '@', 1), 40));
  return new;
end $$;

create trigger guard_signup before insert on auth.users for each row execute function private.guard_signup();
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- ───────────── Enable RLS everywhere
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ───────────── Column privileges (server-maintained columns)
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path, bio, star_color, timezone, preferences, onboarded_at) on public.profiles to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update on public.messages from authenticated;
grant update (deleted_at) on public.messages to authenticated;
revoke update on public.study_sessions from authenticated;
revoke all on public.allowed_emails, public.ai_requests from anon, authenticated;

-- ───────────── Policies
-- profiles
create policy profiles_select on public.profiles for select to authenticated using (private.is_member());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- subjects (readable by both so shared items can be labelled)
create policy subjects_select on public.subjects for select to authenticated using (private.is_member());
create policy subjects_insert on public.subjects for insert to authenticated with check (owner_id = (select auth.uid()));
create policy subjects_update on public.subjects for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy subjects_delete on public.subjects for delete to authenticated using (owner_id = (select auth.uid()));

-- owner-only tables
do $$
declare t text;
begin
  foreach t in array array['folders', 'study_plans'] loop
    execute format('create policy %1$s_all on public.%1$I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- shareable owner tables: notes, decks, quizzes, tasks, study_goals
do $$
declare t text;
begin
  foreach t in array array['notes', 'decks', 'quizzes', 'tasks', 'study_goals'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (owner_id = (select auth.uid()) or (is_shared and private.is_member()))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- children of shareable parents
create policy flashcards_select on public.flashcards for select to authenticated using (private.can_view_deck(deck_id));
create policy flashcards_insert on public.flashcards for insert to authenticated with check (owner_id = (select auth.uid()) and private.owns_deck(deck_id));
create policy flashcards_update on public.flashcards for update to authenticated using (private.owns_deck(deck_id)) with check (private.owns_deck(deck_id));
create policy flashcards_delete on public.flashcards for delete to authenticated using (private.owns_deck(deck_id));

create policy quiz_questions_select on public.quiz_questions for select to authenticated using (private.can_view_quiz(quiz_id));
create policy quiz_questions_insert on public.quiz_questions for insert to authenticated with check (private.owns_quiz(quiz_id));
create policy quiz_questions_update on public.quiz_questions for update to authenticated using (private.owns_quiz(quiz_id)) with check (private.owns_quiz(quiz_id));
create policy quiz_questions_delete on public.quiz_questions for delete to authenticated using (private.owns_quiz(quiz_id));

create policy note_attachments_select on public.note_attachments for select to authenticated using (private.can_view_note(note_id));
create policy note_attachments_insert on public.note_attachments for insert to authenticated with check (owner_id = (select auth.uid()) and private.owns_note(note_id));
create policy note_attachments_delete on public.note_attachments for delete to authenticated using (owner_id = (select auth.uid()));

-- per-user learning rows
create policy flashcard_progress_all on public.flashcard_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy review_events_select on public.review_events for select to authenticated using (user_id = (select auth.uid()));
create policy review_events_insert on public.review_events for insert to authenticated with check (user_id = (select auth.uid()) and private.can_view_deck(deck_id));
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy quiz_attempts_insert on public.quiz_attempts for insert to authenticated with check (user_id = (select auth.uid()));
create policy quiz_attempts_update on public.quiz_attempts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy quiz_attempts_delete on public.quiz_attempts for delete to authenticated using (user_id = (select auth.uid()));
create policy task_completions_select on public.task_completions for select to authenticated using (user_id = (select auth.uid()));
create policy task_completions_insert on public.task_completions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.tasks t where t.id = task_id and t.owner_id = (select auth.uid())));
create policy task_completions_delete on public.task_completions for delete to authenticated using (user_id = (select auth.uid()));

-- visible to both members (powers Our Space), written by self
create policy study_sessions_select on public.study_sessions for select to authenticated using (private.is_member());
create policy study_sessions_insert on public.study_sessions for insert to authenticated with check (user_id = (select auth.uid()));
create policy study_sessions_delete on public.study_sessions for delete to authenticated using (user_id = (select auth.uid()));
create policy user_achievements_select on public.user_achievements for select to authenticated using (private.is_member());
create policy achievements_select on public.achievements for select to authenticated using (private.is_member());
create policy xp_events_select on public.xp_events for select to authenticated using (user_id = (select auth.uid()));

-- private per-user
create policy ai_conversations_all on public.ai_conversations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_messages_select on public.ai_messages for select to authenticated using (user_id = (select auth.uid()));
create policy ai_messages_insert on public.ai_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy ai_messages_delete on public.ai_messages for delete to authenticated using (user_id = (select auth.uid()));
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- social
create policy study_rooms_select on public.study_rooms for select to authenticated using (private.is_member());
create policy messages_select on public.messages for select to authenticated using (private.is_member());
create policy messages_insert on public.messages for insert to authenticated with check (sender_id = (select auth.uid()) and private.is_member());
create policy messages_update on public.messages for update to authenticated using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));
create policy message_reactions_select on public.message_reactions for select to authenticated using (private.is_member());
create policy message_reactions_insert on public.message_reactions for insert to authenticated with check (user_id = (select auth.uid()) and private.is_member());
create policy message_reactions_delete on public.message_reactions for delete to authenticated using (user_id = (select auth.uid()));
create policy marketplace_select on public.marketplace_items for select to authenticated using (private.is_member());
create policy marketplace_insert on public.marketplace_items for insert to authenticated with check (seller_id = (select auth.uid()));
create policy marketplace_update on public.marketplace_items for update to authenticated using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy marketplace_delete on public.marketplace_items for delete to authenticated using (seller_id = (select auth.uid()));
-- allowed_emails, ai_requests: RLS on, no policies → service role only.

-- seed the shared room
insert into public.study_rooms (name) values ('Our Room');

-- realtime
alter publication supabase_realtime add table public.messages, public.message_reactions, public.notifications, public.study_sessions;
