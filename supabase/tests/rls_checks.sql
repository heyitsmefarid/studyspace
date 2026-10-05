-- supabase/tests/rls_checks.sql
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  n_private uuid; n_shared uuid; d_private uuid; d_shared uuid; c uuid; c_priv uuid; s_a uuid; n_b uuid;
  cnt int;
  blocked boolean := false;
begin
  insert into public.allowed_emails values ('rls-a@test.local'), ('rls-b@test.local');
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.local', '', now(), now(), now(), '{}', '{}'),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.local', '', now(), now(), now(), '{}', '{}');

  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'intruder@test.local', '', now(), now(), '{}', '{}');
  exception when others then blocked := true;
  end;
  assert blocked, 'signup guard did not block a non-allowlisted email';
  assert (select count(*) from public.profiles where id in (a, b)) = 2, 'profiles not auto-created';

  -- ── act as A: create private + shared content
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.notes (owner_id, title) values (a, 'A private') returning id into n_private;
  insert into public.notes (owner_id, title, is_shared) values (a, 'A shared', true) returning id into n_shared;
  insert into public.decks (owner_id, title) values (a, 'A deck private') returning id into d_private;
  insert into public.decks (owner_id, title, is_shared) values (a, 'A deck shared', true) returning id into d_shared;
  insert into public.flashcards (deck_id, owner_id, front, back) values (d_shared, a, 'Q', 'A') returning id into c;
  insert into public.ai_conversations (user_id, title) values (a, 'secret chat');
  insert into public.flashcards (deck_id, owner_id, front, back) values (d_private, a, 'Private Q', 'A') returning id into c_priv;
  insert into public.subjects (owner_id, name) values (a, 'A subject') returning id into s_a;

  begin
    insert into public.notes (owner_id, title) values (b, 'forged');
    assert false, 'A could insert a note owned by B';
  exception when insufficient_privilege or check_violation then null;
           when others then if sqlerrm like '%row-level security%' then null; else raise; end if;
  end;
  begin
    update public.profiles set xp = 9999 where id = a;
    assert false, 'client could update xp';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- ── act as B
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into cnt from public.notes where id = n_private;          assert cnt = 0, 'B sees A private note';
  select count(*) into cnt from public.notes where id = n_shared;           assert cnt = 1, 'B cannot see A shared note';
  select count(*) into cnt from public.decks where id = d_private;          assert cnt = 0, 'B sees A private deck';
  select count(*) into cnt from public.flashcards where deck_id = d_shared; assert cnt = 1, 'B cannot see shared deck cards';
  select count(*) into cnt from public.ai_conversations;                    assert cnt = 0, 'B sees A AI conversations';
  select count(*) into cnt from public.profiles;                            assert cnt >= 2, 'B cannot see profiles';
  update public.notes set title = 'hijack' where id = n_shared;
  get diagnostics cnt = row_count;                                          assert cnt = 0, 'B edited A shared note';
  delete from public.flashcards where id = c;
  get diagnostics cnt = row_count;                                          assert cnt = 0, 'B deleted A card';
  insert into public.flashcard_progress (user_id, card_id) values (b, c);  -- B studies the shared deck with own progress
  select count(*) into cnt from public.flashcard_progress;                  assert cnt = 1, 'B progress row missing';
  begin
    select count(*) into cnt from public.allowed_emails;
    assert false, 'allowed_emails readable by clients';
  exception when insufficient_privilege then null;
  end;
  -- hardening: owner-bound foreign keys and file paths
  insert into public.notes (owner_id, title) values (b, 'B note') returning id into n_b;
  begin
    insert into public.notes (owner_id, title, subject_id) values (b, 'uses A subject', s_a);
    assert false, 'B linked a note to A subject';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.flashcard_progress (user_id, card_id) values (b, c_priv);
    assert false, 'B tracked progress on A private card';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.review_events (user_id, card_id, deck_id, grade) values (b, c_priv, d_shared, 2);
    assert false, 'B logged a review for a card outside the named deck';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.note_attachments (note_id, owner_id, storage_path, file_name, mime_type, size_bytes)
    values (n_b, b, a::text || '/' || n_private::text || '/secret.pdf', 'secret.pdf', 'application/pdf', 10);
    assert false, 'B attached a file path from A folder';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- ── gamification (as A); server-side xp only
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds, xp_earned)
  values (a, 'pomodoro', now() - interval '30 minutes', now(), 1500, 9999);
  execute 'reset role';
  assert (select xp_earned from public.study_sessions where user_id = a) = 10, 'client-chosen xp_earned was kept';
  assert (select current_streak from public.profiles where id = a) = 1, 'streak not started';
  assert exists (select 1 from public.user_achievements where user_id = a and achievement_code = 'first_light'), 'first_light not unlocked';
  assert (select xp from public.profiles where id = a) = 35, 'xp should be 10 (session) + 25 (first_light)';
  perform private.award_xp(a, 'study_session', (select id::text from public.study_sessions where user_id = a));
  assert (select xp from public.profiles where id = a) = 35, 'award_xp is not idempotent';
  -- yesterday-active → streak continues; local-midnight logic uses profile timezone
  update public.profiles set last_active_date = (now() at time zone 'Asia/Manila')::date - 1, current_streak = 4 where id = b;
  perform private.touch_streak(b);
  assert (select current_streak from public.profiles where id = b) = 5, 'streak did not continue from yesterday';

  -- integrity: XP sources must be plausible and internals are not callable by users
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds)
    values (a, 'custom', now() - interval '10 minutes', now(), 36000);
    assert false, 'session claimed more focus than wall-clock time';
  exception when check_violation then null;
  end;
  begin
    insert into public.quiz_attempts (user_id, mode, started_at, finished_at, score, total, answers)
    values (a, 'practice', now(), now(), 5, 5, '[{"correct":false},{"correct":false},{"correct":false},{"correct":false},{"correct":false}]');
    assert false, 'quiz attempt score did not match its answers';
  exception when check_violation then null;
  end;
  begin
    perform private.award_xp(a, 'achievement', 'forged', 9999);
    assert false, 'user could call award_xp directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set timezone = 'Mars/Olympus' where id = a;
    assert false, 'invalid timezone accepted';
  exception when check_violation then null;
  end;
  execute 'reset role';

  raise exception 'RLS CHECKS PASSED';
end $$;
