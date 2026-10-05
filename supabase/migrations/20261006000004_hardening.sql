-- supabase/migrations/20261006000004_hardening.sql
-- Bind foreign keys and storage paths to their owners (security review findings):
--  1. a note_attachments row may only point at a file in the uploader's own folder, and storage reads
--     through attachments require the file's folder to match the attachment owner;
--  2. rows may only reference subjects/folders/tasks/plans the writer owns, and cards/notes/decks/quizzes
--     the writer can see; review events must name a card that belongs to the named deck.
-- Policies are tightened in place with ALTER POLICY (nothing is dropped).

create or replace function private.owns_subject(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p is null or exists (select 1 from public.subjects where id = p and owner_id = (select auth.uid()));
$$;
create or replace function private.owns_folder(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p is null or exists (select 1 from public.folders where id = p and owner_id = (select auth.uid()));
$$;
create or replace function private.owns_task(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p is null or exists (select 1 from public.tasks where id = p and owner_id = (select auth.uid()));
$$;
create or replace function private.owns_plan(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p is null or exists (select 1 from public.study_plans where id = p and owner_id = (select auth.uid()));
$$;
create or replace function private.can_view_card(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.flashcards f where f.id = p and private.can_view_deck(f.deck_id));
$$;
create or replace function private.card_in_deck(p_card uuid, p_deck uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.flashcards where id = p_card and deck_id = p_deck);
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

alter policy folders_all on public.folders
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id));
alter policy study_plans_all on public.study_plans
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id));

alter policy notes_insert on public.notes
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id) and private.owns_folder(folder_id));
alter policy notes_update on public.notes
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id) and private.owns_folder(folder_id));

alter policy decks_insert on public.decks
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id)
              and (source_note_id is null or private.can_view_note(source_note_id)));
alter policy decks_update on public.decks
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id)
              and (source_note_id is null or private.can_view_note(source_note_id)));

alter policy quizzes_insert on public.quizzes
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id)
              and (source_deck_id is null or private.can_view_deck(source_deck_id)));
alter policy quizzes_update on public.quizzes
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id)
              and (source_deck_id is null or private.can_view_deck(source_deck_id)));

alter policy tasks_insert on public.tasks
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id) and private.owns_plan(plan_id));
alter policy tasks_update on public.tasks
  with check (owner_id = (select auth.uid()) and private.owns_subject(subject_id) and private.owns_plan(plan_id));

alter policy flashcard_progress_all on public.flashcard_progress
  with check (user_id = (select auth.uid()) and private.can_view_card(card_id));

alter policy review_events_insert on public.review_events
  with check (user_id = (select auth.uid()) and private.can_view_deck(deck_id) and private.card_in_deck(card_id, deck_id));

alter policy quiz_attempts_insert on public.quiz_attempts
  with check (user_id = (select auth.uid()) and (quiz_id is null or private.can_view_quiz(quiz_id)));
alter policy quiz_attempts_update on public.quiz_attempts
  with check (user_id = (select auth.uid()) and (quiz_id is null or private.can_view_quiz(quiz_id)));

alter policy study_sessions_insert on public.study_sessions
  with check (user_id = (select auth.uid()) and private.owns_subject(subject_id) and private.owns_task(task_id));

alter policy note_attachments_insert on public.note_attachments
  with check (owner_id = (select auth.uid()) and private.owns_note(note_id)
              and split_part(storage_path, '/', 1) = (select auth.uid())::text);

alter policy "ss note files read" on storage.objects
  using (bucket_id = 'note-files' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.note_attachments a
               where a.storage_path = name
                 and a.owner_id::text = (storage.foldername(name))[1]
                 and private.can_view_note(a.note_id))));
alter policy "ss card images read" on storage.objects
  using (bucket_id = 'card-images' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.decks d
               where d.id = private.deck_from_path(name)
                 and d.owner_id::text = (storage.foldername(name))[1]
                 and private.can_view_deck(d.id))));
