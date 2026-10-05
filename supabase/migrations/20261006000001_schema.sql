-- supabase/migrations/20261006000001_schema.sql
create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────── People
create table public.allowed_emails (
  email text primary key check (email = lower(email))
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  avatar_path text,
  bio text not null default '' check (char_length(bio) <= 280),
  star_color text not null default '#7CC4FF' check (star_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'Asia/Manila',
  xp integer not null default 0 check (xp >= 0),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  preferences jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── Content
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#A99CFF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'book-open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default 'Untitled' check (char_length(title) <= 200),
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '' check (char_length(content_text) <= 200000),
  is_pinned boolean not null default false,
  is_favorite boolean not null default false,
  is_shared boolean not null default false,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content_text, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'file' check (kind in ('file', 'image')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) <= 255),
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 0 and 10485760),
  created_at timestamptz not null default now()
);

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 1000),
  tags text[] not null default '{}',
  is_shared boolean not null default false,
  source_note_id uuid references public.notes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'qa' check (type in ('qa', 'mcq', 'tf')),
  front text not null check (char_length(front) between 1 and 1000),
  back text not null default '' check (char_length(back) <= 2000),
  options jsonb,
  correct_answer text,
  front_image_path text,
  back_image_path text,
  topic text check (char_length(topic) <= 60),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'mcq' or (jsonb_typeof(options) = 'array' and correct_answer is not null)),
  check (type <> 'tf' or correct_answer in ('True', 'False'))
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 1000),
  source text not null default 'manual' check (source in ('manual', 'ai', 'deck')),
  source_note_ids uuid[] not null default '{}',
  source_deck_id uuid references public.decks (id) on delete set null,
  time_limit_seconds integer check (time_limit_seconds between 30 and 14400),
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  type text not null check (type in ('mcq', 'tf')),
  question text not null check (char_length(question) between 1 and 1000),
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_answer text not null,
  explanation text not null default '' check (char_length(explanation) <= 2000),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  topic text check (char_length(topic) <= 60),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── Learning
create table public.flashcard_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.flashcards (id) on delete cascade,
  ease numeric(4,2) not null default 2.5,
  interval_minutes integer not null default 0,
  repetitions integer not null default 0,
  due_at timestamptz,
  last_reviewed_at timestamptz,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  review_count integer not null default 0,
  state text not null default 'new' check (state in ('new', 'learning', 'reviewing', 'mastered')),
  primary key (user_id, card_id)
);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.flashcards (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  grade smallint not null check (grade between 0 and 3),
  was_correct boolean,
  session_key uuid,
  reviewed_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  task_id uuid,
  mode text not null check (mode in ('pomodoro', 'custom', 'stopwatch')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  focus_seconds integer not null check (focus_seconds >= 0),
  cards_studied integer not null default 0,
  questions_answered integer not null default 0,
  correct_answers integer not null default 0,
  xp_earned integer not null default 0,
  together boolean not null default false,
  room_id uuid,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Quiz',
  subject_id uuid references public.subjects (id) on delete set null,
  mode text not null check (mode in ('practice', 'timed', 'random', 'subject', 'deck')),
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_seconds integer not null default 0,
  score integer not null default 0,
  total integer not null default 0,
  accuracy numeric(5,4) not null default 0,
  answers jsonb not null default '[]'::jsonb,
  topic_breakdown jsonb not null default '{}'::jsonb,
  ai_analysis jsonb,
  session_id uuid references public.study_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  check (score between 0 and total)
);

-- ───────────── Planning
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null default 'Study plan',
  exam_date date not null,
  inputs jsonb not null,
  plan jsonb not null,
  added_to_calendar_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  subject_id uuid references public.subjects (id) on delete set null,
  kind text not null default 'task' check (kind in ('task', 'assignment', 'exam', 'deadline', 'study_session')),
  due_at timestamptz,
  start_at timestamptz,
  duration_minutes integer check (duration_minutes between 5 and 720),
  all_day boolean not null default false,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekdays', 'weekly', 'monthly')),
  recurrence_until date,
  source text not null default 'manual' check (source in ('manual', 'ai_plan')),
  plan_id uuid references public.study_plans (id) on delete set null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_sessions
  add constraint study_sessions_task_fk foreign key (task_id) references public.tasks (id) on delete set null;

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  occurrence_date date not null,
  completed_at timestamptz not null default now(),
  unique (task_id, occurrence_date)
);

create table public.study_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('weekly_minutes', 'weekly_cards', 'weekly_quizzes', 'custom')),
  target integer not null check (target > 0),
  progress integer not null default 0,
  due_date date,
  is_shared boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── Rewards
create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null,
  xp_reward integer not null default 0,
  sort integer not null default 0
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_code text not null references public.achievements (code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null,
  ref text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);

-- ───────────── Social (Phase 2 UI)
create table public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.marketplace_items (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  price numeric(10,2) not null check (price >= 0),
  category text not null check (category in ('textbooks', 'notes', 'reviewers', 'study_materials', 'school_supplies', 'other')),
  condition text not null check (condition in ('new', 'like_new', 'good', 'fair')),
  image_path text,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'star', 'file', 'listing', 'system')),
  body text not null default '' check (char_length(body) <= 4000),
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  listing_id uuid references public.marketplace_items (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '⭐', '😂', '👏', '💪')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('deadline', 'exam', 'study_reminder', 'message', 'shared_deck', 'shared_note', 'achievement', 'streak')),
  title text not null,
  body text not null default '',
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

-- ───────────── AI
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 120),
  mode text not null default 'explain_simply',
  difficulty text not null default 'intermediate',
  context_type text check (context_type in ('note', 'deck', 'quiz', 'attempt', 'plan', 'subject')),
  context_id uuid,
  context_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 20000),
  provider text,
  model text,
  fell_back boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task text not null,
  provider text,
  status text not null check (status in ('ok', 'error')),
  error_code text,
  created_at timestamptz not null default now()
);

-- ───────────── Indexes (every FK + hot filters)
create index on public.subjects (owner_id);
create index on public.folders (owner_id);
create index on public.folders (subject_id);
create index notes_owner_updated_idx on public.notes (owner_id, updated_at desc);
create index on public.notes (subject_id);
create index on public.notes (folder_id);
create index notes_search_idx on public.notes using gin (search);
create index on public.note_attachments (note_id);
create index on public.note_attachments (owner_id);
create index on public.decks (owner_id, updated_at desc);
create index on public.decks (subject_id);
create index on public.decks (source_note_id);
create index on public.flashcards (deck_id, position);
create index on public.flashcards (owner_id);
create index on public.flashcard_progress (user_id, due_at);
create index on public.flashcard_progress (card_id);
create index on public.review_events (user_id, reviewed_at desc);
create index on public.review_events (card_id);
create index on public.review_events (deck_id);
create index on public.review_events (session_key);
create index on public.quizzes (owner_id, updated_at desc);
create index on public.quizzes (subject_id);
create index on public.quizzes (source_deck_id);
create index on public.quiz_questions (quiz_id, position);
create index on public.quiz_attempts (user_id, finished_at desc);
create index on public.quiz_attempts (quiz_id);
create index on public.quiz_attempts (subject_id);
create index on public.quiz_attempts (session_id);
create index on public.study_sessions (user_id, started_at desc);
create index on public.study_sessions (subject_id);
create index on public.study_sessions (task_id);
create index on public.study_plans (owner_id, created_at desc);
create index on public.study_plans (subject_id);
create index on public.tasks (owner_id, due_at);
create index on public.tasks (owner_id, start_at);
create index on public.tasks (subject_id);
create index on public.tasks (plan_id);
create index on public.task_completions (user_id);
create index on public.study_goals (owner_id);
create index on public.user_achievements (achievement_code);
create index on public.xp_events (user_id, created_at desc);
create index on public.study_rooms (created_by);
create index on public.marketplace_items (seller_id);
create index on public.marketplace_items (created_at desc);
create index on public.messages (room_id, created_at desc);
create index on public.messages (sender_id);
create index on public.messages (listing_id);
create index on public.message_reactions (user_id);
create index on public.notifications (user_id, created_at desc);
create index on public.ai_conversations (user_id, updated_at desc);
create index on public.ai_messages (conversation_id, created_at);
create index on public.ai_messages (user_id);
create index on public.ai_requests (user_id, created_at desc);

-- ───────────── updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','subjects','folders','notes','decks','flashcards','quizzes','quiz_questions',
                           'study_plans','tasks','study_goals','marketplace_items','ai_conversations']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
