# StudySpace — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review
**Concept:** Constellations

---

## 1. Intent

### What the user asked for
A private, all-in-one study platform for exactly two people (the user and their girlfriend) that combines notes, flashcards, quizzes, an AI tutor, planning, study sessions, progress tracking, gamification, a shared space, chat and a small marketplace. It must be a real application (real auth, database, AI calls, validation, error handling), polished and responsive (mobile matters), light and dark, deployable on free tiers, and **creative**.

The features must form one connected loop:

```
NOTES → AI → FLASHCARDS → QUIZZES → STUDY MODE → PROGRESS → AI ANALYSIS → STUDY PLAN → CALENDAR → MORE STUDY
```

### Decisions made during brainstorming
| Topic | Decision |
|---|---|
| Creative concept | **Constellations** — every study session becomes a star; your sky + your partner's sky = "Our Space" |
| Supabase | New free project **"StudySpace"**, region ap-southeast-1 (Singapore) |
| Architecture | Static Vite SPA + Supabase (direct, RLS-protected) + **one Supabase Edge Function `ai`** |
| Libraries | TanStack Query, TipTap, Recharts, React Router, Zod, date-fns |
| Sharing | `is_shared` flag; shared items are **read-only for the partner**, with "Copy to mine" |
| AI limits | 15 requests/min and 200/day per person (server-side env, adjustable) |
| Build order | Phase 1 = core loop; Phase 2 = shared space, chat, achievements/goals, marketplace, notifications |

### Assumptions (not explicitly stated by the user)
- Currency for the marketplace is ₱ (PHP); default timezone `Asia/Manila`, editable per profile.
- Accounts are created in the app (decided 2026-10-06, no hard-coded emails or credentials): the first sign-up becomes member #1, who invites the second member by email from Settings → Partner; the database refuses any third account. Supabase's built-in email only reaches project team members, so "Confirm email" should be off (or custom SMTP via Resend + iskonnect.me added) for the partner's sign-up and for password-reset emails.
- The partner is shown by their display name in the UI, never as "Girlfriend".
- AI replies arrive whole (no token streaming) in this version.

### Success criteria
1. At most two accounts can ever exist: the first sign-up, plus the one email it invites; any other sign-up fails at the database.
2. The full loop works end-to-end on real Supabase data: write a note → generate flashcards (review/edit) → study with spaced repetition → take a quiz → AI analysis → AI study plan → "Add to Calendar" → study mode session → stats/XP/streak update.
3. No AI key appears anywhere in the built frontend bundle (`dist/` grep is clean).
4. RLS checks pass: each user cannot read the other's private notes, decks, quizzes, AI conversations or notifications; the Supabase security advisor reports no errors.
5. Every page is usable at 375 px wide and in both themes.
6. Every AI failure mode (section 7.6) has a defined UI state; no AI failure crashes the app.
7. Everything runs on free tiers (Supabase Free, Vercel Hobby, Gemini/Groq free tiers).

---

## 2. Architecture

```
┌──────────────────────────────┐        ┌───────────────────────────────────────┐
│  React SPA (Vite, Vercel)     │  JWT   │  Supabase                              │
│                               ├───────►│  Auth · Postgres (RLS) · Storage ·     │
│  features/*  ── supabase-js ──┤        │  Realtime                              │
│  services/ai/aiService.ts ────┼───────►│  Edge Function `ai` ──► Gemini (primary)│
└──────────────────────────────┘        │                       └► Groq (fallback)│
                                         └───────────────────────────────────────┘
```

- The SPA reads and writes Supabase directly; Row Level Security is the only data gate.
- All AI traffic goes through the `ai` Edge Function. Secrets (`GEMINI_API_KEY`, `GROQ_API_KEY`, models, limits) exist only as Supabase function secrets.
- Gamification logic (XP, levels, streaks, achievements) and notification fan-out run in Postgres functions/triggers so they are consistent and cannot be forged by the client.
- Hosting: Vercel (SPA rewrite in `vercel.json`); a Netlify `_redirects` file is included for portability. Browser env vars are only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public by design).

### 2.1 Tech stack
React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Lucide React · React Router · TanStack Query · TipTap · Recharts · Zod · date-fns · supabase-js v2 · Vitest. Edge Function runtime: Deno (Supabase).

### 2.2 Source layout
```
src/
  app/                 router, providers (query, auth, theme, toast), AppShell, error boundaries
  components/ui/       Button, Card, Dialog, Sheet, Tabs, Toast, Skeleton, EmptyState, ProgressRing, Field…
  components/sky/      StarField (canvas), Constellation, OrbitTimer, Comet, ShootingStar, StarRank badge
  features/
    auth/ onboarding/ dashboard/ notes/ flashcards/ quizzes/ tutor/ planner/
    study/ stats/ gamification/ space/ chat/ market/ notifications/ profile/ settings/
      each: api.ts (queries + TanStack hooks), logic.ts (pure, unit-tested), components/, pages/
  lib/                 supabase client, database.types.ts (generated), queryClient, dates, cn, errors
  services/ai/
    aiService.ts       CLIENT facade — the only AI module app code may import
    types.ts           shared request/response/error types
    schemas.ts         shared Zod schemas for every structured task
    prompts.ts         TUTOR_SYSTEM_PROMPT, FLASHCARD_SYSTEM_PROMPT, QUIZ_SYSTEM_PROMPT, …
    postprocess.ts     shared cleanup (dedupe, option checks, date clamps)
    router.ts          SERVER: task → provider selection, retry, fallback, repair
    geminiProvider.ts  SERVER: Gemini REST adapter (key injected, never read from env here)
    groqProvider.ts    SERVER: Groq REST adapter (key injected)
  styles/tokens.css    design tokens (Night / Daybreak)
supabase/
  migrations/          SQL migrations (schema, RLS, functions, triggers, storage, seed achievements)
  functions/ai/        index.ts (HTTP handler: auth, limits, logging) — imports src/services/ai server modules
  tests/               RLS verification SQL
docs/superpowers/      specs/, plans/
```

An ESLint `no-restricted-imports` rule forbids any file outside `src/services/ai/` and `supabase/functions/` from importing `router`, `geminiProvider` or `groqProvider`. The provider files contain no `import.meta.env`/`Deno.env` access; keys are passed in by the Edge Function.

---

## 3. Experience design — Constellations

### 3.1 Visual language
- **Night (dark):** deep indigo sky (`#0B1026`-range background, never pure black), layered surfaces, hairline borders, starlight text. Default theme follows the OS; user can force Night or Daybreak.
- **Daybreak (light):** warm paper-dawn gradient, ink-navy text, stars drawn as ink outlines.
- **Accents:** starlight gold (XP, streaks, "together"), nebula violet (primary actions), aurora teal (success/mastery), comet coral (errors/hard cards). All text/background pairs meet WCAG AA in both themes.
- **Personal star colours:** each user picks one at onboarding (defaults: user = Sirius blue, partner = rose). Their stars, avatars rings and chart series use it. Anything shared/together renders in gold.
- **Type:** Fraunces (display/headings, soft optical axis) + Figtree (UI/body); tabular numerals for timers and stats.
- **Shape & motion:** rounded cards, soft glows instead of heavy shadows, subtle twinkle/drift animations, page transitions under 200 ms. All motion sits behind `prefers-reduced-motion: no-preference`; the canvas sky renders static when reduced motion is requested and pauses when the tab is hidden.
- **Copy:** navigation labels stay plain (Notes, Flashcards, Quizzes, Planner, Study, Tutor, Our Space, Chat, Market, Stats). The theme lives in hero copy, empty states, loaders and rewards (e.g. empty notes: "Every constellation starts with one star. Write your first note.").

### 3.2 Signature components
1. **Your Sky** (dashboard hero) — canvas starfield. Each study session = one star in the user's colour; size/brightness ∝ duration; the last 3 days twinkle. Stars of the same subject connect into that subject's constellation; line opacity ∝ subject mastery. Hover/tap a star → "Biology · 45 min · Oct 3".
2. **Deck constellation** — each card is a star whose brightness maps to its mastery state (new → learning → reviewing → mastered). Shown on deck pages and deck cards.
3. **Orbit Timer** — study mode timer: a planet orbiting a ring; completed focus intervals leave a moon; breaks shift the palette ("eclipse").
4. **Nova** — the AI tutor persona. "Ask Nova about this" appears on notes, decks, quizzes, quiz results and plans and opens the tutor with that content attached as context. Loading state = a constellation being drawn line by line.
5. **Star ranks** — levels map to ranks: Stardust (1–2), Comet (3–4), Moon (5–7), Planet (8–11), Star (12–16), Nebula (17–24), Galaxy (25+).
6. **Comet streak** — the streak is a comet whose tail lengthens with streak length.
7. **Results sky** — after a quiz, each question is a star (lit = correct, dim = wrong), clustered by topic; strong topics glow, weak topics are faint. Nova's analysis sits beside it.
8. **Our Space ❤️** (Phase 2) — both skies side by side, joined by gold lines for sessions studied together; You / Partner / Together stat blocks; **shooting stars** (a short note that animates across the partner's screen in realtime); presence-aware **study together** with synced orbit timers.

### 3.3 Layout & navigation
- **Desktop/tablet (≥ 768 px):** collapsible left sidebar with logo (four-point star in an orbit ring), primary nav, partner presence dot (Phase 2), notifications bell, profile.
- **Mobile (< 768 px):** bottom tab bar — Home, Notes, Study, Nova, Our Space — plus a "More" sheet (Flashcards, Quizzes, Planner, Stats, Chat, Market, Settings). 16 px gutters, 44 px touch targets, no horizontal scroll.
- **Ctrl/⌘+K quick-action palette:** create note, create deck, start quiz, ask Nova, start study session, add task, jump to any note/deck.
- Toasts for outcomes, skeletons for loading, illustrated empty states, route-level error boundaries, offline banner.

### 3.4 Routes
| Route | Page |
|---|---|
| `/login`, `/set-password` | Login; set new password (recovery/invite links) |
| `/onboarding` | "Name your star": display name, star colour, subjects, timezone |
| `/` | Dashboard |
| `/notes`, `/notes/:id` | Notes list (sidebar of subjects/folders) and editor |
| `/decks`, `/decks/:id`, `/decks/:id/study` | Decks, deck detail/editor, review session |
| `/quizzes`, `/quizzes/:id`, `/quizzes/:id/take`, `/attempts/:id` | Quizzes, editor, taking, results |
| `/tutor`, `/tutor/:conversationId` | Nova |
| `/planner`, `/planner/ai` | Calendar (month/week/day via `?view=`), AI study planner |
| `/study` | Study mode setup + running session + summary |
| `/stats` | Analytics |
| `/space` | Our Space (Phase 2) |
| `/chat` | Chat / study room (Phase 2) |
| `/market`, `/market/:id` | Marketplace (Phase 2) |
| `/notifications` | Notification centre (Phase 2) |
| `/profile/:userId?` | Profile (own or partner's) |
| `/settings/:section?` | Settings |

All routes except `/login` and `/set-password` are protected; a user without a completed profile is sent to `/onboarding`. Pages are lazy-loaded per route.

---

## 4. Features

### 4.1 Authentication & profile
- Email + password login and sign-up (Supabase Auth). Sign-up is open only for the first account and afterwards only for the email member #1 invited (Settings → Partner).
- `/set-password` handles Supabase recovery links; Settings → Password changes the password for a signed-in user (requires current session).
- Logout everywhere it is expected (profile menu, settings).
- Onboarding on first login creates the profile (display name, star colour, subjects, timezone) and a real "Welcome to StudySpace" note explaining the loop (deletable).
- Profile: avatar (upload), name, bio, subjects, XP, level/rank, streak, total study time, achievements, headline stats. The partner's profile is viewable read-only.

### 4.2 Dashboard
Greeting by time of day with the user's name and today's date; Your Sky hero with comet streak; **Start studying** primary button; quick actions (Create note, Create flashcards, Start quiz, Ask Nova, Start study session, Add task); Today (tasks due today + cards due now); Upcoming (assignments and exams, next 7 days); total study time; recent notes; recent decks with mastery rings; recent quiz scores (sparkline); subject progress bars (mastery per subject); current goals (Phase 2); Nova quick-ask input; AI recommendations card (section 7.4, cached per day in the browser with a Refresh button).

### 4.3 Notes
- Create/edit/delete; **autosave** (1 s debounce after typing, status "Saving… / Saved just now", retry on failure, unsaved-changes guard).
- TipTap editor: headings, bold/italic/underline, bullet/numbered lists, **task checkboxes**, **highlight**, code, blockquote, links, **images** (uploaded to Storage), slash-menu for blocks.
- Attachments (any file ≤ 10 MB) listed under the note, stored privately.
- Organise by **subject** and **folder** (flat folders, optional subject). Pin, favourite, share toggle.
- **Search**: Postgres full-text search over title + plain text (`websearch_to_tsquery`), 300 ms debounce, filters for subject/folder/pinned/favourite/shared.
- Shared notes from the partner appear in a "Shared with me" section, read-only, with "Copy to mine".
- **AI actions** (toolbar + slash menu; work on the whole note or the selected text): Summarize, Explain simply, Generate flashcards, Generate quiz, Practice questions, Study guide, Ask Nova about this. Text results open in a side panel with *Insert into note*, *Save as new note*, *Copy*. Structured results open the review editors (4.4, 4.5).

### 4.4 Flashcards
- Decks: title, description, subject, tags, shared flag, optional source note. Create/edit/delete, search, filter by subject/tag.
- Card types: **Q/A**, **multiple choice** (2–6 options, one correct), **true/false**, **image** (optional image on front and/or back for any type). Add/edit/delete/reorder cards.
- **AI-generated cards** (from one note or a selection): returns `{question, answer, difficulty, topic}`; shown in a review grid where each card can be edited, removed or regenerated before **Save to deck** (new or existing deck).
- **Study session** (`/decks/:id/study`): queue = due cards (oldest due first) then up to *new-cards-per-day* new cards (default 20), shuffle option. Card flip (Space), grade **Again / Hard / Good / Easy** (keys 1–4). MCQ/TF cards are answered first; correct → Good, wrong → Again (user may override to Hard/Easy). "Again" cards are re-inserted 3–5 cards later in the same session. Progress bar, session summary (cards studied, accuracy, XP).
- **Spaced repetition (SM-2 lite)** per user per card — see 6.2.
- Tracked per user per card: correct, incorrect, review count, ease, interval, mastery state, last reviewed, next review.
- Shared decks from the partner can be studied with the viewer's own progress; editing is owner-only.

### 4.5 Quizzes
- Quiz: title, description, subject, source (`manual` | `ai` | `deck`), time limit (optional), shared flag. Questions: **multiple choice** or **true/false**, with explanation, difficulty, topic.
- **Modes:** Practice (instant feedback + explanation per question, untimed), Timed (countdown for whole quiz, auto-submit at 0), Random (N random questions drawn from chosen quizzes/subjects), Subject (all quizzes in a subject), Deck quiz (built from a deck: TF/MCQ cards used as-is; Q/A cards become MCQs using other cards' answers as distractors — requires ≥ 4 cards).
- **AI-generated quizzes** from one or more selected notes: returns `{question, options, correctAnswer, explanation, difficulty, topic}`; review/edit screen before saving.
- **Results page** (`/attempts/:id`): score, accuracy, time, correct/incorrect list with explanations, results sky, strong topics (≥ 80 %), weak topics (< 60 %), recommended review (linked notes/decks for weak topics), and the **Nova analysis** panel (7.4) with actions: *Add suggested cards to a deck*, *Schedule next session* (creates a planner task), *Ask Nova about my mistakes*.

### 4.6 Nova — AI tutor
- Conversation list + chat view; *New conversation*; rename/delete conversations.
- **Modes:** Explain Simply, Deep Explanation, Quiz Me, Give Examples, Summarize, Study With Me. **Difficulty:** beginner / intermediate / advanced. **Fast mode** toggle (Groq-first).
- Conversations may carry a **context** (`note`, `deck`, `quiz`, `attempt`, `plan`, `subject`) set by "Ask Nova about this"; the context chip is shown at the top and its text is sent with each request (truncated to the context budget, 7.5).
- Messages are rendered as safe Markdown (no raw HTML). History is stored in `ai_conversations` / `ai_messages`; the last 20 messages are sent as history.

### 4.7 AI study planner
- Inputs: subject, exam date, topics (each with confidence 1–5), available hours per day (per weekday optional), preferred study times (morning/afternoon/evening/night).
- Output (validated): a summary and sessions `{date, startTime?, topic, durationMinutes, activity, priority, notes}` — activity ∈ learn/review/flashcards/practice quiz/mock exam/rest.
- Shown as a timeline grouped by day; sessions editable/removable. **Add to Calendar** creates `tasks` of kind `study_session` (linked to the plan) and an `exam` task on the exam date if one doesn't already exist. Plans are saved in `study_plans` and can be reopened.

### 4.8 Planner / calendar
- Views: **month** grid, **week** (7 columns, timed blocks + all-day list), **day** (agenda timeline). Mobile defaults to day/agenda with a week strip.
- Task kinds: task, assignment, exam, deadline, study session. Fields: title, description, subject, kind, due date/time (or start + duration for sessions), priority (low/medium/high), completion, recurrence (none/daily/weekdays/weekly/monthly, optional end date), source (manual/ai_plan), shared flag.
- Create/edit/delete/complete; drag to reschedule on desktop (week/month); quick-add from dashboard and palette.
- Recurring tasks are expanded client-side; completion is recorded per occurrence (`task_completions`). Editing a recurring task edits the series.
- A study-session task has **Start** → opens study mode pre-configured with its subject/topic.

### 4.9 Study mode
- Setup: subject, optional topic/task, content (a deck to review, a quiz to take, a note to read, or none), timer type: **Pomodoro** (focus/short break/long break/every N — defaults 25/5/15/4 from preferences) or **custom** countdown, or open-ended stopwatch.
- Running: distraction-free full-screen sky, Orbit Timer, current interval and phase, session progress bar, embedded flashcard review or quiz, pause/resume, skip break, finish. Survives refresh (state persisted in `sessionStorage`).
- End: summary — study duration (focus time), cards studied, questions answered, accuracy, subject, XP earned, streak status — and the session is saved to `study_sessions`. Sessions shorter than 1 minute are discarded with a notice.

### 4.10 Progress, XP & analytics
- XP, levels and streaks are live in Phase 1 (6.3); achievements and goals in Phase 2.
- **Stats page:** total / daily (last 14 days) / weekly (last 12 weeks) / monthly (last 12 months) study time; flashcards studied & mastered; quiz average & best; strongest & weakest subject (blend of quiz accuracy and card mastery); streak & longest streak; completed tasks; per-subject breakdown. Range selector; charts follow the dataviz skill guidance; every chart has an accessible table fallback.

### 4.11 Phase 2 features
- **Our Space ❤️:** You / Partner / Together blocks (streak, cards studied, hours, achievements); both skies with gold "together" links; shared notes, decks, goals and recent sessions feed; send a **shooting star** (message of kind `star`, ≤ 140 chars) that animates across the partner's screen in realtime; reactions/encouragement on partner activity.
- **Study together:** Realtime Presence on the room channel shows the partner as online / studying (subject, time left). Either partner can start a **synced orbit timer**: Broadcast events carry `{phase, startedAt, durationMs, pausedAt}` and both clients derive the remaining time from shared timestamps. A session where both were studying with overlapping time ≥ 10 min is flagged `together = true` (feeds gold links and the *Binary Star* achievement).
- **Chat** (one room, "Our Room"): text, timestamps grouped by day, typing indicator, online status, emoji reactions (❤️ 🔥 ⭐ 😂 👏 💪), image/file sharing (≤ 10 MB), soft-delete own messages ("message deleted"), message search, listing cards from the marketplace. No voice/video.
- **Achievements & goals:** achievements in 6.4; goals (personal or shared) of kind weekly minutes / weekly cards / weekly quizzes / custom with target and period or due date; progress computed from data (shared goals sum both partners).
- **Marketplace:** listings with title, description, price (₱), category (textbooks, notes, reviewers, study materials, school supplies, other), condition (new, like new, good, fair), image, seller, created date, status (available/reserved/sold). Search (debounced), category filter, listing detail, **Message seller** (posts a listing card into chat). Owner can edit, mark sold, delete. No payments.
- **Notifications:** bell with unread count + `/notifications`. Kinds: deadline, exam, study reminder, new message, shared deck update, shared note, achievement, streak milestone. Toasts for realtime arrivals; optional browser notifications (permission-gated, toggle in settings).
- **Settings:** Profile · Password · Appearance (System/Night/Daybreak) · Notifications (per-kind toggles, browser notifications) · Study (pomodoro lengths, new cards/day, daily goal minutes, timezone, preferred study times) · AI (fast mode, default difficulty, explanation style) · Privacy (show online status, share my activity in Our Space, default share setting for new items) · Logout.

---

## 5. Data model

All tables have `id uuid primary key default gen_random_uuid()` unless noted, `created_at timestamptz default now()`, and `updated_at` (maintained by a shared trigger) where rows are editable. Foreign keys cascade on delete from owners/parents unless noted.

### 5.1 Tables
**People**
- `allowed_emails(email text pk)` — no client access at all.
- `profiles(id uuid pk → auth.users, display_name, avatar_path, bio, star_color, timezone default 'Asia/Manila', xp int default 0, current_streak int, longest_streak int, last_active_date date, preferences jsonb, onboarded_at)` — `preferences` holds theme, notification toggles, study and AI preferences, privacy toggles (validated by a Zod schema in the app, defaults merged on read).

**Content**
- `subjects(owner_id, name, color, icon)`
- `folders(owner_id, name, subject_id?)`
- `notes(owner_id, subject_id?, folder_id?, title, content jsonb, content_text text, is_pinned, is_favorite, is_shared, search tsvector generated from title+content_text)` + GIN index.
- `note_attachments(note_id, owner_id, kind in (file, image), storage_path, file_name, mime_type, size_bytes)` — every object in `note-files` has a row (images too), which the storage read policy relies on
- `decks(owner_id, subject_id?, title, description, tags text[], is_shared, source_note_id?)`
- `flashcards(deck_id, owner_id, type in (qa, mcq, tf), front, back, options jsonb?, correct_answer?, front_image_path?, back_image_path?, topic?, difficulty in (easy, medium, hard)?, position)`
- `quizzes(owner_id, subject_id?, title, description, source in (manual, ai, deck), source_note_ids uuid[], source_deck_id?, time_limit_seconds?, is_shared)`
- `quiz_questions(quiz_id, type in (mcq, tf), question, options jsonb, correct_answer, explanation, difficulty, topic, position)`

**Learning**
- `flashcard_progress(user_id, card_id, ease numeric default 2.5, interval_minutes int, repetitions int, due_at, last_reviewed_at, correct_count, incorrect_count, review_count, state in (new, learning, reviewing, mastered); pk(user_id, card_id))`
- `review_events(user_id, card_id, deck_id, grade smallint 0–3, was_correct bool?, session_key uuid?, reviewed_at)` — `session_key` groups one review run (client-generated) for the flashcard-session XP
- `quiz_attempts(quiz_id?, user_id, title, subject_id?, mode in (practice, timed, random, subject, deck), started_at, finished_at, duration_seconds, score, total, accuracy numeric, answers jsonb, topic_breakdown jsonb, ai_analysis jsonb?, session_id?)` — `quiz_id` is null for random/subject attempts; `answers` stores the question snapshot so results survive question edits.
- `study_sessions(user_id, subject_id?, task_id?, mode in (pomodoro, custom, stopwatch), started_at, ended_at, focus_seconds, cards_studied, questions_answered, correct_answers, xp_earned, together bool default false, room_id?)`

**Planning**
- `tasks(owner_id, title, description, subject_id?, kind in (task, assignment, exam, deadline, study_session), due_at?, start_at?, duration_minutes?, all_day bool, priority in (low, medium, high), recurrence in (none, daily, weekdays, weekly, monthly), recurrence_until?, source in (manual, ai_plan), plan_id?, is_shared)`
- `task_completions(task_id, user_id, occurrence_date date, completed_at; unique(task_id, occurrence_date))` — used for all tasks (non-recurring tasks use their due date).
- `study_plans(owner_id, subject_id?, exam_date, inputs jsonb, plan jsonb, added_to_calendar_at?)`
- `study_goals(owner_id, title, kind in (weekly_minutes, weekly_cards, weekly_quizzes, custom), target int, progress int (custom only), due_date?, is_shared, completed_at?)`

**Rewards**
- `achievements(code text pk, name, description, icon, xp_reward, sort)` — seeded.
- `user_achievements(user_id, achievement_code, unlocked_at; pk(user_id, achievement_code))`
- `xp_events(user_id, amount, reason, ref_id?, created_at)` — ledger; insert trigger updates `profiles.xp`.

**Social**
- `study_rooms(name, created_by)` — one seeded room, "Our Room".
- `messages(room_id, sender_id, kind in (text, star, file, listing, system), body, attachment_path?, attachment_name?, attachment_mime?, listing_id?, deleted_at?)`
- `message_reactions(message_id, user_id, emoji; pk(message_id, user_id, emoji))`
- `marketplace_items(seller_id, title, description, price numeric(10,2), category, condition, image_path?, status in (available, reserved, sold))`
- `notifications(user_id, kind, title, body, link, dedupe_key?, read_at?; unique(user_id, dedupe_key))`

**AI**
- `ai_conversations(user_id, title, mode, difficulty, context_type?, context_id?, context_title?)`
- `ai_messages(conversation_id, user_id, role in (user, assistant), content, provider?, model?, fell_back bool)`
- `ai_requests(user_id, task, provider?, status in (ok, error), error_code?, created_at)` — written only by the Edge Function (service role); index on `(user_id, created_at)`.

### 5.2 Row Level Security
RLS is enabled on every table. Helper functions (`security definer`, `stable`, fixed `search_path`):
- `is_member()` — `auth.uid()` has a profile.
- `partner_id()` — the other member's id.
- `can_view_deck(deck_id)`, `can_view_quiz(quiz_id)`, `can_view_note(note_id)` — owner, or shared and `is_member()`.

| Table group | Select | Insert / Update / Delete |
|---|---|---|
| profiles | any member | own row only (xp/streak columns not updatable by clients — only via security-definer functions) |
| subjects, folders | owner, or any member (subjects are needed to label shared items) | owner |
| notes, decks, quizzes, tasks, study_goals | owner, or `is_shared` and member | owner |
| flashcards, quiz_questions, note_attachments | via `can_view_*` on parent | parent owner |
| flashcard_progress, review_events, quiz_attempts, task_completions | own rows (partner may read aggregates through `get_space_stats()` RPC) | own rows |
| study_sessions, user_achievements | any member (powers Our Space) | own rows (achievements insert only via functions) |
| xp_events | own rows | none from client (functions only) |
| study_plans, ai_conversations, ai_messages, notifications | own rows | own rows (notifications: update `read_at`/delete only) |
| study_rooms, messages, message_reactions | members | insert as self; update/delete own messages (soft delete) and own reactions |
| marketplace_items | members | seller |
| allowed_emails, ai_requests | none | none (service role only) |

**Signup guard:** a `before insert` trigger on `auth.users` allows the first account, then only emails in `allowed_emails` (written by the `invite_partner` RPC, callable by members only), and refuses everything once two members exist.

### 5.3 Storage
Private buckets: `avatars`, `note-files` (note images + attachments), `card-images`, `chat-files`, `market-images`. Object paths start with the uploader's id (`{uid}/…`); insert/update/delete only into your own prefix. Read: `avatars`, `chat-files`, `market-images` → any member; `note-files` → owner or the note is shared (checked via `note_attachments`/note image path lookup); `card-images` → `can_view_deck`. Files are displayed via short-lived signed URLs (cached in TanStack Query). Upload limits enforced client-side and by bucket `file_size_limit` (avatars 2 MB, others 10 MB); allowed MIME types set per bucket.

### 5.4 Realtime
Publication includes `messages`, `message_reactions`, `notifications`, `study_sessions` (Our Space live updates). Presence + Broadcast on channel `room:{roomId}` for online/studying status, typing, synced timers and shooting-star animations.

---

## 6. Core logic

### 6.1 Server functions (Postgres)
- `award_xp(reason text, ref_id uuid)` — fixed amounts by reason: `study_session` +10, `flashcard_session` +10, `quiz_completed` +20, `task_completed` +5, `achievement` +reward. Idempotent per `(user, reason, ref_id)`. Called from triggers, never with a client-chosen amount.
- `touch_streak(user)` — computes today in the user's timezone; a day counts when the user has a study session ≥ 5 min focus, ≥ 1 flashcard review, or a finished quiz attempt. Updates `current_streak`, `longest_streak`, `last_active_date`; emits streak-milestone notifications at 3, 7, 14, 30, 50, 100 (to self and partner).
- `check_achievements(user)` — evaluates thresholds after relevant inserts and unlocks + notifies + awards XP.
- `refresh_reminders()` — called on app load; inserts deduplicated notifications for deadlines/assignments due within 24 h, exams in 3 days and 1 day, and a study reminder if nothing studied today after the user's preferred time.
- `get_space_stats()` — returns per-member and combined totals for Our Space (time, cards studied, streaks, achievements) without exposing private rows.
- Notification triggers: new message → partner; shared note/deck created or updated → partner (dedupe key per item per hour); achievement unlocked → self.

### 6.2 Spaced repetition (SM-2 lite, pure TS in `features/flashcards/logic.ts`, mirrored in a test suite)
Grades: Again 0, Hard 1, Good 2, Easy 3. Ease starts 2.5, min 1.3.
- New/learning card: Again → due in 10 min; Hard → 1 day; Good → 1 day; Easy → 4 days.
- Review card: Again → reps 0, due in 10 min, ease −0.20; Hard → interval × 1.2, ease −0.15; Good → interval × ease; Easy → interval × ease × 1.3, ease +0.15.
- State: `new` (never reviewed), `learning` (interval < 1 day), `reviewing` (1–20 days), `mastered` (≥ 21 days). Deck mastery % = mastered / total.
Progress rows are upserted client-side (own rows only); a `review_events` row is inserted per review.

### 6.3 Levels
Cumulative XP for level *n* = 50 · n · (n − 1) → L2 at 100, L3 at 300, L4 at 600, L5 at 1000… Rank from level per 3.2.

### 6.4 Achievements (seeded)
| Code | Name | Rule | XP |
|---|---|---|---|
| first_light | First Light | first study session | 25 |
| meteor_shower | Meteor Shower | 100 flashcard reviews | 50 |
| star_cluster | Star Cluster | 500 flashcard reviews | 100 |
| seven_day_orbit | 7-Day Orbit | 7-day streak | 50 |
| full_moon | Full Moon | 30-day streak | 150 |
| supernova | Supernova | perfect quiz (≥ 5 questions) | 50 |
| light_year | Light-Year | 10 hours of focus time | 100 |
| quiz_master | Quiz Master | 10 quizzes at ≥ 80 % | 100 |
| long_night | Long Night | one session ≥ 2 hours focus | 75 |
| binary_star | Binary Star | first study-together session (Phase 2) | 50 |

### 6.5 Quiz scoring
Score = correct count; accuracy = correct / total; `topic_breakdown` = per topic `{correct, total, accuracy}`; strong ≥ 80 %, weak < 60 % (topics with ≥ 2 questions; single-question topics are listed as "needs more data").

---

## 7. AI

### 7.1 Edge Function `ai`
`POST /functions/v1/ai` with `{ task, input, options? }` and the user's JWT.
1. **Auth:** verify JWT (`auth.getUser`), require a profile (member) → else `UNAUTHORIZED`.
2. **Limits:** count the user's `ai_requests` in the last 60 s and since local midnight; reject with `RATE_LIMITED` (+ `retryAfter`) or `DAILY_LIMIT`. Defaults `AI_MINUTE_LIMIT=15`, `AI_DAILY_LIMIT=200`.
3. **Input validation:** Zod schema per task; text inputs capped (7.5) → `BAD_INPUT` on violation.
4. **Run** via `router.ts` (7.2), **post-process + validate** (7.3).
5. **Log** to `ai_requests` (task, provider, status, error code) with the service role.
6. **Respond** with the envelope (7.6). CORS restricted to the configured site origins (`ALLOWED_ORIGINS`) plus localhost in development.

Secrets: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `AI_MINUTE_LIMIT`, `AI_DAILY_LIMIT`, `ALLOWED_ORIGINS`. Model names are never hardcoded in code; `.env.example` shows example values only. If a provider's key or model is missing, that provider is treated as unavailable.

### 7.2 Provider routing
```ts
interface AIProvider {
  name: 'gemini' | 'groq' | string;
  generate(req: { system: string; messages: ChatMessage[]; json?: { schema: JsonSchema };
                  temperature?: number; maxOutputTokens?: number; signal?: AbortSignal }): Promise<{ text: string }>;
}
// errors are thrown as ProviderError { kind: 'rate_limit'|'unavailable'|'timeout'|'bad_request'|'auth'|'empty', retryAfterMs? }
```
- Each task has a route: `{ primary, fallback: boolean, structured: boolean, temperature, maxOutputTokens }`. Gemini is primary for every task; **Groq is primary** for `tutor` when Fast mode is on and for `practice` (fast practice questions).
- On `rate_limit` / `unavailable` / `timeout` from the primary: one retry after backoff (honour `retryAfterMs` if ≤ 3 s, else 1 s), then fall back to the other provider if `fallback` is true (true for all current tasks). `auth`/`bad_request` do not retry; they fall back once (misconfiguration on one provider shouldn't block the user).
- Per-call timeout 30 s (AbortController).
- Adding a provider = implement `AIProvider` in a new file and register it in `router.ts`.

### 7.3 Structured output
- Gemini: `responseMimeType: "application/json"` + `responseSchema` from the task schema. Groq: `response_format: { type: "json_object" }` with the JSON shape described in the system prompt.
- Parse → Zod validate → post-process:
  - flashcards: trim, drop empty, drop near-duplicates (normalised token Jaccard ≥ 0.8 against each other and against existing deck cards), cap count;
  - quizzes: options unique (2–6; TF exactly ["True","False"]), `correctAnswer` must equal one option, drop invalid questions, require ≥ 1 valid question;
  - study plan: dates within [today, exam date], durations 15–180 min, per-day total ≤ available hours (excess sessions trimmed, user told);
  - analysis/recommendations: arrays capped, unknown action types dropped.
- If parsing/validation fails: one **repair** call (same provider) with the validation errors; if still invalid → `INVALID_OUTPUT`. If valid but empty after cleanup → `EMPTY`.
- Nothing generated is saved by the function. The client shows review/edit UIs and re-validates with the same Zod schemas before inserting into Supabase.

### 7.4 Tasks, prompts and schemas
`prompts.ts` exports `TUTOR_SYSTEM_PROMPT` (+ per-mode and per-difficulty addenda), `SUMMARY_SYSTEM_PROMPT`, `EXPLAIN_SYSTEM_PROMPT`, `SIMPLIFY_SYSTEM_PROMPT`, `FLASHCARD_SYSTEM_PROMPT`, `QUIZ_SYSTEM_PROMPT`, `PRACTICE_SYSTEM_PROMPT`, `STUDY_GUIDE_SYSTEM_PROMPT`, `STUDY_PLAN_SYSTEM_PROMPT`, `QUIZ_ANALYSIS_SYSTEM_PROMPT`, `RECOMMENDATIONS_SYSTEM_PROMPT`. All share a preamble prioritising: accuracy; clear explanations; educational usefulness; concision where appropriate; **no fabricated sources**; honest uncertainty; for cards/quizzes, test understanding rather than copying sentences; stay within the provided material unless asked.

| Client function | Task | Output |
|---|---|---|
| `askTutor()` | tutor | Markdown text |
| `generateSummary()` | summarize | Markdown |
| `explainConcept()` / `simplifyText()` | explain / simplify | Markdown |
| `generateStudyGuide()` | study_guide | Markdown (sections: key ideas, definitions, examples, self-check) |
| `generateFlashcards()` | flashcards | `{ cards: [{ question, answer, difficulty, topic }] }` (5–30, default 12) |
| `generateQuiz()` | quiz | `{ title, questions: [{ type, question, options, correctAnswer, explanation, difficulty, topic }] }` (5–25, default 10) |
| `generatePracticeQuestions()` | practice | `{ questions: [{ question, answer, hint, explanation, topic }] }` — rendered as reveal cards with *Save as flashcards* |
| `generateStudyPlan()` | study_plan | `{ summary, sessions: [{ date, startTime?, topic, durationMinutes, activity, priority, notes? }] }` |
| `analyzeQuizResults()` | quiz_analysis | `{ weakTopics: [{topic, reason}], strongTopics: [{topic, reason}], commonMistakes: [], reviewTopics: [], suggestedFlashcards: [{question, answer, topic}], nextSession: { topic, durationMinutes, activity, why }, encouragement }` |
| `generateRecommendations()` | recommendations | `{ items: [{ title, reason, action: { type: 'review_deck'|'take_quiz'|'open_note'|'plan_exam'|'start_session', targetId? } }] }` — input is a compact stats summary (due cards, weak topics, upcoming exams) |

### 7.5 Context and size budgets
Note/selection input ≤ 24,000 characters (longer notes are cut at a block boundary and the UI says so); tutor context ≤ 12,000 characters; tutor history = last 20 messages; quiz analysis input = question snapshots + answers (≤ 50 questions). The client builds context text from the referenced entity (note text, deck cards, quiz questions + last attempt, plan sessions).

### 7.6 Response envelope and client states
```ts
type AIResult<T> =
  | { ok: true;  data: T; meta: { provider: string; model: string; fellBack: boolean; remainingToday: number } }
  | { ok: false; error: { code: 'UNAUTHORIZED'|'RATE_LIMITED'|'DAILY_LIMIT'|'PROVIDER_UNAVAILABLE'
                                  |'INVALID_OUTPUT'|'EMPTY'|'BAD_INPUT'|'NETWORK';
                           message: string; retryable: boolean; retryAfter?: number } };
```
`aiService.ts` never throws: network failures and non-JSON responses map to `NETWORK`. A shared `useAiTask` hook exposes `idle | loading | success | empty | error`, `retry()`, and `cancel()`. Every AI surface renders: loading (constellation-drawing loader + cancel), success, empty ("Nova couldn't find enough material — try a longer note"), and error with a code-specific message and Retry (disabled with countdown for `RATE_LIMITED`; `DAILY_LIMIT` shows the reset time). A small "answered by Groq" badge appears when `fellBack` is true. Route-level error boundaries catch anything else.

---

## 8. Non-functional

- **Performance:** route-level lazy loading; TanStack Query caching (stale time 30 s, longer for static lists), optimistic updates for pin/favourite/complete/reactions/grading; debounced search (300 ms); capped lists (notes 500 per view; messages paginated 50 per page); selected columns only; indexes on all foreign keys and common filters (`owner_id, updated_at`, `user_id, due_at`, `room_id, created_at`); starfield canvas capped at 60 fps and paused when hidden.
- **Security:** RLS everywhere; no secrets in client code or the repo (`.env*` git-ignored, `.env.example` committed); user content rendered without raw HTML (TipTap JSON, safe Markdown, text nodes); uploaded file types/sizes restricted; Edge Function validates auth and input; CORS restricted; security advisor clean.
- **Accessibility:** WCAG AA contrast in both themes, visible focus rings, keyboard flows (flashcards Space/1–4, quiz 1–6/Enter, palette Ctrl+K), labelled controls, `aria-live` for timer phase changes and toasts, reduced-motion support.
- **Resilience:** offline banner; Supabase errors mapped to friendly toasts with retry; autosave retries; study session state survives refresh.

---

## 9. Phases

**Phase 1 — core loop**
1. Scaffold (Vite, TS strict, Tailwind v4, ESLint, Vitest), design tokens (Night/Daybreak), UI primitives, app shell (sidebar, mobile tabs, palette, toasts, error boundaries).
2. Supabase project, full schema migration (all tables incl. Phase 2), RLS, storage buckets, functions/triggers, achievement seed, generated types, RLS verification.
3. Auth (login, set password, change password, protected routes), onboarding, profile basics.
4. Notes (editor, autosave, search, subjects/folders, pin/favourite/share, images/attachments).
5. Flashcards (decks, card types, study session, spaced repetition, deck constellation).
6. Quizzes (manual + deck + random/timed/practice/subject modes, results sky).
7. AI (Edge Function, router/providers/prompts/schemas, note AI actions, flashcard & quiz generation review flows, Nova tutor with context, quiz analysis, study planner → calendar, recommendations).
8. Planner (month/week/day, tasks, recurrence, completions).
9. Study mode (orbit timer, embedded review/quiz, summary, save).
10. Progress (XP/levels/streaks wiring, dashboard with Your Sky, stats page).

**Phase 2 — the two of you**
Our Space + shooting stars · chat & study room (presence, synced timers, reactions, files, search, delete) · achievements & goals UI · marketplace · notifications centre + reminders · Profile and Settings completion.

Each phase gets its own implementation plan in `docs/superpowers/plans/`.

---

## 10. Testing & verification

- **Unit (Vitest):** SM-2 scheduler and state transitions; level/rank math; streak day logic (timezone edges); recurrence expansion; quiz scoring/topic breakdown; deck-quiz distractor building; all AI Zod schemas; post-processing (dedupe, option checks, plan clamps); router retry/fallback/repair with fake providers; `aiService` envelope mapping (network errors, non-JSON).
- **Database:** SQL verification script run via the Supabase connector impersonating each user (`set local role authenticated` + `request.jwt.claims`) covering every RLS row in 5.2, the signup guard, XP idempotency and streak updates. Supabase security + performance advisors after each migration.
- **Edge Function:** deployed and exercised with real user tokens for each task; forced-failure path verified (invalid model name → fallback).
- **Build gates per phase:** `tsc --noEmit`, ESLint, Vitest, `vite build`, and `grep` of `dist/` for key material; then run the app and walk the loop at desktop and 375 px widths in both themes.

---

## 11. Deployment & setup checklist (user steps marked 👤)
1. Supabase project created and migrated (done by Claude via connector).
2. 👤 Create the first account at `/signup`, then invite the partner from Settings → Partner; the partner signs up at `/signup` with that email.
3. 👤 Set function secrets (Dashboard → Edge Functions → Secrets): `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `ALLOWED_ORIGINS` (limits optional).
4. 👤 Auth → Email: turn off "Confirm email" (or add Resend SMTP) so the partner's sign-up and password resets work.
5. Vercel project with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; deploy (`vercel deploy --prod`).
6. Note: Supabase Free pauses projects after ~7 days without activity.

## 12. Out of scope
Voice/video calls; payments; more than two users or public signup; native mobile apps; offline editing/sync; token streaming for AI replies; collaborative real-time co-editing of notes.
