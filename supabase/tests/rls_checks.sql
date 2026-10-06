-- supabase/tests/rls_checks.sql
-- Behavioural security checks, run AFTER both members have signed up (it uses the two real accounts and creates no
-- auth users — the sign-up guard would refuse them). Paste into Supabase → SQL Editor (runs as postgres) or run it
-- with execute_sql. Everything happens inside one DO block that ends by raising, so ALL changes roll back.
-- Expected result: ERROR "RLS CHECKS PASSED". Any other error names the check that failed.
do $$
declare
  a uuid; b uuid;
  n_private uuid; n_shared uuid; d_private uuid; d_shared uuid; c uuid; c_priv uuid; s_a uuid; n_b uuid;
  qz uuid; q1 uuid; q2 uuid; att uuid; sess uuid; t_end timestamptz;
  cnt int;
begin
  select id into a from public.profiles order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  assert a is not null and b is not null, 'run this after both members have signed up';
  assert (select count(*) from public.profiles) = 2, 'StudySpace should have exactly two members';

  -- ── storage: no HTML/SVG/script uploads (0010)
  assert not exists (
    select 1 from storage.buckets where id in ('note-files', 'chat-files')
      and (allowed_mime_types is null or 'text/html' = any (allowed_mime_types) or 'image/svg+xml' = any (allowed_mime_types))
  ), 'attachment buckets accept HTML/SVG or have no type allowlist';

  -- ── act as A: create private + shared content
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.notes (owner_id, title) values (a, 'RLS A private') returning id into n_private;
  insert into public.notes (owner_id, title, is_shared) values (a, 'RLS A shared', true) returning id into n_shared;
  insert into public.decks (owner_id, title) values (a, 'RLS A deck private') returning id into d_private;
  insert into public.decks (owner_id, title, is_shared) values (a, 'RLS A deck shared', true) returning id into d_shared;
  insert into public.flashcards (deck_id, owner_id, front, back) values (d_shared, a, 'Q', 'A') returning id into c;
  insert into public.flashcards (deck_id, owner_id, front, back) values (d_private, a, 'Private Q', 'A') returning id into c_priv;
  insert into public.ai_conversations (user_id, title) values (a, 'RLS secret chat');
  insert into public.subjects (owner_id, name) values (a, 'RLS A subject') returning id into s_a;

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
  begin
    update public.profiles set timezone = 'Mars/Olympus' where id = a;
    assert false, 'invalid timezone accepted';
  exception when check_violation then null;
  end;
  begin
    perform private.award_xp(a, 'achievement', 'forged', 9999);
    assert false, 'user could call award_xp directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reserve_ai_request(a, 'tutor', 15, 200);
    assert false, 'members can call reserve_ai_request (it is for the Edge Function only)';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.invite_partner('third@example.com');
    assert false, 'a third member could be invited';
  exception when others then if sqlerrm not like '%two members%' then raise; end if;
  end;

  -- quiz attempts are graded by the server (0007): forged `correct` flags and unknown questions are not trusted
  insert into public.quizzes (owner_id, title) values (a, 'RLS quiz') returning id into qz;
  insert into public.quiz_questions (quiz_id, type, question, options, correct_answer, topic) values (qz, 'mcq', 'Q1?', '["A","B"]', 'A', 'Cells') returning id into q1;
  insert into public.quiz_questions (quiz_id, type, question, options, correct_answer) values (qz, 'mcq', 'Q2?', '["A","B"]', 'A') returning id into q2;
  insert into public.quiz_attempts (user_id, quiz_id, mode, started_at, finished_at, duration_seconds, score, total, answers, topic_breakdown)
  values (a, qz, 'practice', now() - interval '1 minute', now(), 60, 2, 2, jsonb_build_array(
    jsonb_build_object('questionId', q1, 'chosen', 'B', 'correct', true),
    jsonb_build_object('questionId', q2, 'chosen', ' a ', 'correct', false)),
    '{"Cells": {"correct": 9, "total": 9, "accuracy": 1}}')
  returning id into att;
  assert (select score from public.quiz_attempts where id = att) = 1, 'forged correct flags changed the score';
  assert (select (answers -> 1 ->> 'correct')::boolean from public.quiz_attempts where id = att), 'case/space variant not graded correct';
  assert (select topic_breakdown from public.quiz_attempts where id = att)
    = '{"Cells": {"correct": 0, "total": 1, "accuracy": 0}, "General": {"correct": 1, "total": 1, "accuracy": 1}}'::jsonb,
    'topic_breakdown was not derived from the graded answers (0012)';
  begin
    insert into public.quiz_attempts (user_id, mode, started_at, finished_at, duration_seconds, total, answers)
    values (a, 'practice', now() - interval '1 minute', now(), 60, 1, jsonb_build_array(jsonb_build_object('questionId', gen_random_uuid(), 'chosen', 'A')));
    assert false, 'attempt with an unknown question id was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.quiz_attempts (user_id, quiz_id, mode, started_at, finished_at, duration_seconds, total, answers)
    values (a, qz, 'practice', now(), now(), 0, 2, jsonb_build_array(jsonb_build_object('questionId', q1, 'chosen', 'A'), jsonb_build_object('questionId', q2, 'chosen', 'A')));
    assert false, 'quiz finished in 0 s was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.quiz_attempts set score = 2 where id = att;
    assert false, 'client could change an attempt score';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.flashcards set owner_id = b where id = c;
    assert false, 'A handed a card to B (0012)';
  exception when others then if sqlerrm like '%row-level security%' then null; else raise; end if;
  end;
  update public.quiz_attempts set ai_analysis = '{"encouragement":"ok"}' where id = att;
  get diagnostics cnt = row_count;                                          assert cnt = 1, 'member cannot save Nova analysis on own attempt';

  -- reviews: server timestamps and a 2-second repeat guard (0007)
  insert into public.review_events (user_id, card_id, deck_id, grade) values (a, c, d_shared, 2);
  begin
    insert into public.review_events (user_id, card_id, deck_id, grade) values (a, c, d_shared, 2);
    assert false, 'the same card was logged twice within 2 s';
  exception when check_violation then null;
  end;

  -- study sessions: plausible, within a day, non-overlapping; xp_earned is set by the server (0006–0008)
  t_end := now() - interval '1 minute';
  while exists (select 1 from public.study_sessions where user_id = a
                and tstzrange(started_at, ended_at, '[)') && tstzrange(t_end - interval '26 minutes', t_end, '[)')) loop
    t_end := t_end - interval '30 minutes';
  end loop;
  insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds, xp_earned, together)
  values (a, 'pomodoro', t_end - interval '25 minutes', t_end, 1500, 9999, true) returning id into sess;
  assert (select xp_earned from public.study_sessions where id = sess) = 10, 'client-chosen xp_earned was kept';
  assert not (select together from public.study_sessions where id = sess), 'a solo session claimed together (0012)';
  begin
    insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds)
    values (a, 'custom', t_end - interval '20 minutes', t_end - interval '5 minutes', 600);
    assert false, 'overlapping session accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds)
    values (a, 'custom', now() - interval '10 minutes', now(), 36000);
    assert false, 'session claimed more focus than wall-clock time';
  exception when check_violation then null;
  end;
  begin
    insert into public.study_sessions (user_id, mode, started_at, ended_at, focus_seconds)
    values (a, 'custom', now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', 1800);
    assert false, 'session saved days after it ended';
  exception when check_violation then null;
  end;
  execute 'reset role';

  assert (select count(*) from public.xp_events where user_id = a and reason = 'study_session' and ref = sess::text) <= 1, 'duplicate session XP';
  perform private.award_xp(a, 'study_session', sess::text);
  assert (select count(*) from public.xp_events where user_id = a and reason = 'study_session' and ref = sess::text) <= 1, 'award_xp is not idempotent';
  -- yesterday-active → streak continues (local day from the profile timezone)
  update public.profiles set last_active_date = (now() at time zone timezone)::date - 1, current_streak = 4 where id = b;
  perform private.touch_streak(b);
  assert (select current_streak from public.profiles where id = b) = 5, 'streak did not continue from yesterday';

  -- ── act as B (partner)
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into cnt from public.notes where id = n_private;          assert cnt = 0, 'B sees A private note';
  select count(*) into cnt from public.notes where id = n_shared;           assert cnt = 1, 'B cannot see A shared note';
  select count(*) into cnt from public.decks where id = d_private;          assert cnt = 0, 'B sees A private deck';
  select count(*) into cnt from public.flashcards where deck_id = d_shared; assert cnt = 1, 'B cannot see shared deck cards';
  select count(*) into cnt from public.ai_conversations where user_id = a;  assert cnt = 0, 'B sees A AI conversations';
  select count(*) into cnt from public.quiz_attempts where user_id = a;     assert cnt = 0, 'B sees A quiz attempts';
  select count(*) into cnt from public.profiles;                            assert cnt = 2, 'B cannot see both profiles';
  update public.notes set title = 'hijack' where id = n_shared;
  get diagnostics cnt = row_count;                                          assert cnt = 0, 'B edited A shared note';
  delete from public.flashcards where id = c;
  get diagnostics cnt = row_count;                                          assert cnt = 0, 'B deleted A card';
  insert into public.flashcard_progress (user_id, card_id) values (b, c);  -- B studies the shared deck with own progress
  select count(*) into cnt from public.flashcard_progress where card_id = c; assert cnt = 1, 'B progress row missing';
  begin
    select count(*) into cnt from public.allowed_emails;
    assert false, 'allowed_emails readable by clients';
  exception when insufficient_privilege then null;
  end;
  insert into public.notes (owner_id, title) values (b, 'RLS B note') returning id into n_b;
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
  begin
    insert into public.quiz_attempts (user_id, quiz_id, mode, started_at, finished_at, duration_seconds, total, answers)
    values (b, qz, 'practice', now() - interval '1 minute', now(), 60, 1, jsonb_build_array(jsonb_build_object('questionId', q1, 'chosen', 'A')));
    assert false, 'B graded against a question from A private quiz';
  exception when check_violation then null;
  end;
  execute 'reset role';

  -- ── a signed-in account that is not a member cannot invite
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.invite_partner('someone@example.com');
    assert false, 'a non-member could invite';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  raise exception 'RLS CHECKS PASSED';
end $$;
