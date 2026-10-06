# StudySpace Phase 2 — "The two of you" — Design

- **Date:** 2026-10-06
- **Status:** approved in conversation (foundation + screens); this document is the written spec for review
- **Parent spec:** `docs/superpowers/specs/2026-10-06-studyspace-design.md` (§4.11, §5, §6) — this spec refines and, where it says so, overrides it
- **Branch base:** `feat/ui-polish` (Phase 1 + UI polish + review fixes)

## 1. Decisions taken

| Topic | Decision |
|---|---|
| Scope | All of Phase 2 in one spec and one plan, built feature by feature |
| Features | Our Space (two skies, shooting stars, study together, activity feed, shared goals) · Chat ("Our Room") · Notifications centre + reminders · Achievements & goals UI · Settings (Notifications, Privacy) · navigation clean-up |
| **Market** | **Removed** (overrides parent §4.11). No page, no menu item, no listing cards in chat. The unused `marketplace_items` table and `market-images` bucket stay in the database (empty, RLS-protected); dropping them is a separate, later decision |
| Notifications | In-app only: bell + centre + toasts, and optional system notifications **while StudySpace is open in a tab**. No push when closed, no service worker |
| Live updates | Supabase Realtime: Postgres Changes for table rows; one **private** channel per room for Presence + Broadcast, authorised by RLS on `realtime.messages` |
| Not in Phase 2 | push notifications, read receipts, message editing, voice/video, payments, more than one chat room |

## 2. Success criteria

1. Our Space, Chat and Notifications work end to end between the two real accounts; the "soon" badges and placeholder pages are gone and Market is no longer in the navigation.
2. A message, reaction, shooting star or notification sent by one member appears for the other within ~1 s without a reload; online/studying status and typing show live.
3. Two members who study at the same time (≥ 10 min overlap) get both sessions marked `together` by the server, which unlocks *Binary Star* and draws gold links in Our Space.
4. Nothing new is readable or joinable by anyone but the two members: `rls_checks.sql` (extended) passes, the private room channel refuses non-members, and the Supabase security advisor reports no new warnings beyond the intentional ones listed in §8.
5. Every screen works at 375 px and desktop, in Night and Daybreak, with reduced motion respected (same rules as the UI-polish spec).
6. `npm test`, typecheck, lint, build and `check:bundle` are green.

## 3. Architecture

```
AppShell
 └─ RealtimeProvider (one per signed-in session)
     ├─ channel `room:<ourRoomId>` (private: true)
     │    ├─ postgres_changes: messages (INSERT, UPDATE), message_reactions (INSERT, DELETE),
     │    │                    notifications (INSERT, filter user_id=eq.<me>), study_sessions (INSERT, UPDATE)
     │    ├─ presence: { userId, status: 'online' | 'studying', subject?, endsAt? }  (only if privacy.showOnline)
     │    └─ broadcast: typing · orbit (shared timer) · star-seen
     ├─ writes incoming rows into the TanStack Query cache (no refetch storms)
     └─ connection state → "Reconnecting…" banner; on re-subscribe invalidates chat, notifications, space queries
```

- **Our Room id** is read once from `study_rooms` (seeded `'Our Room'`) and cached for the session.
- Feature code never touches the channel directly; it uses hooks from `src/features/realtime/`:
  `useConnection()`, `usePartnerPresence()`, `useSetMyStatus()`, `useTyping()`, `useRoomEvent(event, handler)`, `sendRoomEvent(event, payload)`.
- Postgres Changes carries only rows the receiver may read (RLS). With two users the volume is tiny, so Postgres Changes is preferred over trigger-driven Broadcast.

### 3.1 Units and files (new unless noted)

| Unit | Responsibility |
|---|---|
| `src/features/realtime/RealtimeProvider.tsx`, `presence.ts`, `useRealtime.ts` | the channel, presence state, broadcast helpers, cache writers, reconnect |
| `src/features/notifications/` — `api.ts`, `Bell.tsx`, `NotificationsPage.tsx`, `toasts.ts`, `browserNotify.ts`, `reminders.ts` | list/mark/delete, bell + popover, page, realtime toasts, system notifications, reminder refresh |
| `src/features/chat/` — `api.ts`, `ChatPage.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `Composer.tsx`, `ReactionBar.tsx`, `TypingIndicator.tsx`, `SearchPanel.tsx`, `grouping.ts` | Our Room |
| `src/features/space/` — `api.ts`, `SpacePage.tsx`, `OurSky.tsx`, `StatBlocks.tsx`, `ActivityFeed.tsx`, `ShootingStarDialog.tsx`, `ShootingStarOverlay.tsx`, `StudyTogether.tsx`, `orbit.ts` | Our Space, stars, shared timer |
| `src/features/goals/` — `api.ts`, `GoalCard.tsx`, `GoalDialog.tsx`, `GoalsList.tsx`, `progress.ts` | goals CRUD + progress |
| `src/features/gamification/AchievementsGrid.tsx` | achievements grid |
| `src/features/settings/sections/NotificationsSection.tsx`, `PrivacySection.tsx` | new settings sections |
| `src/features/study/*` (modify) | shared-orbit mode in the session runner; `room_id` on save |
| `src/app/nav.ts`, `routes.tsx`, `Sidebar.tsx`, `MoreSheet.tsx`, `AppShell.tsx`, mobile top bar (modify) | remove Market + "soon", add bell, partner dot, overlay, provider |
| `src/features/profile/*`, `src/features/dashboard/*` (modify) | achievements + goals on profile; "Current goals" widget |
| `supabase/migrations/20261006000013_phase2.sql` | all server logic below |
| `supabase/tests/rls_checks.sql` (modify) | new behavioural checks |

## 4. Server (migration 13)

### 4.1 Private room channel
RLS policies on `realtime.messages` for `authenticated`:
- `select` and `insert` allowed when `private.is_member()` **and** `realtime.topic() = 'room:' || <id of a study_rooms row>` **and** `extension in ('broadcast', 'presence')`.
- Clients join with `supabase.channel('room:<id>', { config: { private: true } })`.
- **Setup step (one time):** Realtime Settings → disable **"Allow public access"** so only private channels are accepted.

### 4.2 Messages
- **Insert guard** (`before insert`, security definer):
  - `kind` must be `text`, `star` or `file`; `listing` and `system` are rejected (no producer exists).
  - `text`: trimmed body 1–4000 chars. `star`: trimmed body 1–140 chars. `file`: `attachment_path` required, first path segment = `sender_id`, `attachment_name` 1–255 chars, `attachment_mime` set; body optional caption ≤ 4000.
  - Server sets `created_at := now()`, `deleted_at := null`, `listing_id := null`.
- **Delete only:** revoke `update` on `messages` from `authenticated`, grant `update (deleted_at)`. `before update` trigger: an already deleted message cannot change; otherwise `deleted_at := now()`, `body := ''`, `attachment_path/name/mime := null`. The client removes the stored file (own folder) **before** marking the message deleted; if that fails the message is still blanked and the orphan file is unreferenced.
- **Reactions:** insert policy additionally requires the message to exist and not be deleted.
- **Search** is a client query: `ilike` on `body` with `%`/`_`/`\` escaped, `deleted_at is null`, newest first, limit 30.

### 4.3 Notifications
- `private.notify(...)` (replace) skips the insert when the recipient's `preferences->'notifications'->'kinds'->><kind>` is `'false'`.
- Triggers (all security definer, partner = the other member):
  - **messages after insert** → partner, kind `message`, link `/chat`. Text/file: title "`<name>` sent a message", body = first 80 chars (or "📎 `<file name>`"), dedupe `chat:<room>:<floor(epoch/600)>` (at most one per 10 minutes). Star: title "`<name>` sent you a shooting star ✦", body = the star text, dedupe `star:<message id>`.
  - **notes / decks after insert or update**, only when `is_shared` and (row is new, or `is_shared` just turned on, or `title`/content changed) → partner, kind `shared_note` / `shared_deck`, link `/notes/<id>` / `/decks/<id>`, dedupe `<kind>:<id>:<hour bucket>`.
  - achievements and streaks: already notify (Phase 1).
- **`public.refresh_reminders()`** (security definer, acts for `auth.uid()` only, idempotent through dedupe keys). Considers the caller's own **one-off** tasks (`recurrence = 'none'`) not completed for their date:
  - `assignment` / `deadline` / `task` with `due_at` in the next 24 h → kind `deadline`, dedupe `due:<task>`.
  - `exam` whose date (`start_at` or `due_at`) is 3 days or 1 day away in the caller's timezone → kind `exam`, dedupe `exam:<task>:3` / `exam:<task>:1`.
  - Study reminder: nothing studied today (no session ≥ 5 min, no review, no finished attempt — same rule as streaks) and local time is past the start of the first preferred study time (morning 08:00, afternoon 13:00, evening 18:00, night 21:00) → kind `study_reminder`, dedupe `study:<local date>`.
  - Recurring tasks are not reminded in Phase 2 (documented limitation).
  - The client calls it on app load and at most once per hour on window focus.

### 4.4 Studying together
Replace the Phase 1 rule (`together := false`) in `private.on_study_session_before`:
- If the other member has a session overlapping the new one by **≥ 600 s**, set `new.together := true`, mark those overlapping partner sessions `together = true`, and run `private.check_achievements(partner)`. The new row's own achievements run in the existing after-insert trigger.
- `room_id` is accepted only when it names a `study_rooms` row; otherwise it is set to null. `together` is never taken from the client.

### 4.5 Our Space data
- **`public.get_space_stats(p_week_start timestamptz)`** (security definer, members only) → one row per member: `user_id, focus_seconds_total, focus_seconds_week, cards_total, cards_week, quizzes_total, quizzes_week, achievements, current_streak, longest_streak, last_active_date, together_seconds_total` (sum of that member's focus seconds in sessions marked `together`). Counts only; no private titles.
- **`public.space_feed(p_limit int default 30)`** (security definer, members only) → newest events across both members: `session` (subject name, focus minutes, together), `quiz` (accuracy only — no quiz title), `achievement` (name, icon), `shared_note` / `shared_deck` (title, id — only items currently shared). The partner's events are omitted when their `preferences->'privacy'->>'shareActivity'` is `'false'`; the caller always sees their own.
- Both functions: `revoke execute ... from anon, public`; `grant execute ... to authenticated`.

### 4.6 Goals
`study_goals` already exists with shareable-owner RLS. No server change except a check that `progress >= 0`. Progress is computed in the client (§5.5).

## 5. Client behaviour

### 5.1 Realtime provider and presence
- Mounted in `AppShell` after the profile is loaded; one channel; unsubscribes on sign-out.
- Presence payload: `{ userId, status, subject?, endsAt? }`. Status is `studying` while a study session runs (subject name, `endsAt` for timed modes), else `online`. With `privacy.showOnline = false` the member never tracks presence (they still see the partner).
- Partner presence shows as a dot by the partner avatar (sidebar, chat header, Our Space): green = online, gold = studying, none = offline.
- Connection lost (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED` while signed in) → top banner "Reconnecting…", retry with backoff (1 s → 30 s); on `SUBSCRIBED` after a loss → invalidate `chat`, `notifications`, `space`, `sessions` queries.

### 5.2 Notifications
- **Bell** (sidebar + mobile top bar): unread count badge (9+ cap); popover with the latest 5 and "See all".
- **`/notifications`:** grouped by day; mark one / all read; delete; clicking marks read and navigates to `link`.
- **Realtime arrival:** a toast (title + body, action "Open"); if `notifications.browser` is on, permission is granted and `document.hidden`, also a system `Notification` (click focuses the tab and navigates).
- While `/chat` is open, unread `message` notifications are marked read automatically. The Chat nav item shows a badge with the unread `message` notification count.
- Settings → **Notifications:** one switch per kind (deadline, exam, study reminder, message, shared note, shared deck, achievement, streak) stored in `preferences.notifications.kinds`; "System notifications" switch requests permission and explains a denial.
- Settings → **Privacy:** show online status, share my activity in Our Space, new items start shared.

### 5.3 Chat — Our Room
- **Loading:** newest 50 messages; older pages of 50 when scrolled near the top (keeps scroll position). Messages are grouped by local day (Today / Yesterday / `EEE, MMM d`), and consecutive messages by the same sender within 5 minutes form one cluster (pure `groupMessages`, unit-tested).
- **Scrolling:** stays pinned to the bottom when already there; otherwise a "New messages ↓" pill.
- **Composer:** auto-growing textarea; Enter sends, Shift+Enter newline; send disabled when empty; attach button (and paste / drop) for images and files ≤ 10 MB using the existing storage allowlist (`safeContentType`) into `chat-files/<uid>/<uuid>-<name>`; star button opens the shooting-star dialog. Sending is optimistic (pending style); failure shows "Retry" and "Discard" on the bubble; the text is never lost.
- **Bubbles:** text rendered as plain text with auto-linked URLs (`noopener noreferrer`, http/https only), no HTML/Markdown; image → thumbnail from a signed URL, opens full size; other files → chip with name, size, download; star → gold card with sparkle; deleted → "message deleted" in muted italics.
- **Reactions:** hover (desktop) or long-press (touch) shows ❤️ 🔥 ⭐ 😂 👏 💪; chips under the bubble with counts; tap toggles your own.
- **Delete own message:** menu → confirm → remove file (if any) → set `deleted_at`.
- **Typing:** broadcast `typing` at most every 2 s while typing; indicator "`<name>` is typing…" disappears after 4 s without a new event or when their message arrives.
- **Search:** panel with a debounced input (300 ms); results show snippet + date; selecting one loads the 25 messages before and after it and highlights it briefly.
- **Header:** partner avatar, name, presence ("Online", "Studying Biology · 12 min left", or nothing), search button.

### 5.4 Our Space
- **Our sky:** one canvas, two halves (side by side ≥ 768 px, stacked on phones). Each half lays out that member's last-365-day sessions with `layoutSky` in their star colour; sessions marked `together` are joined across the halves by gold lines. Draw-in reveal and reduced-motion rules as in the dashboard sky.
- **Stat blocks:** You / Partner / Together — streak, hours this week, total hours, cards this week, achievements — from `get_space_stats`, counting up.
- **Partner status card:** presence (online / studying with subject and time left / offline) + **Send a shooting star** + **Study together**.
- **Shooting stars:** dialog with a 140-char input and a few presets ("You've got this ✦", "Proud of you", "Water break?"). Sending inserts a `star` message. The receiver's `ShootingStarOverlay` (mounted in `AppShell`) animates a star across the screen with the text and the sender's avatar (≈ 2.5 s), then a toast with "Reply" → `/chat`. Reduced motion → toast only. The sender sees a "sent ✦" toast.
- **Study together (shared orbit):** pure state machine `orbit.ts` (unit-tested). Events broadcast on the room channel: `orbit:start {orbitId, by, durationMs}`, `orbit:pause`, `orbit:resume`, `orbit:end`, `orbit:hello` (late joiner asks for the state), `orbit:sync {orbitId, status, remainingMs}`. Every event carries `remainingMs` at send time; each client anchors `endsAt = receivedAt + remainingMs` (immune to device clock differences). A member who joins late asks with `orbit:hello`; anyone in the orbit answers with `orbit:sync`.
  - Starting: "Study together" → focus length from the starter's settings → the partner sees a banner/toast "`<name>` started a 25-min orbit — Join" (expires when the orbit ends).
  - Joining opens the Study page in shared-orbit mode: the timer follows the shared state; pause/resume/end by either member apply to both; the partner's avatar orbits the timer ring.
  - When the orbit ends (time up or "End"), each member's existing Finish → Summary flow saves their own session with `room_id = Our Room`; the server decides `together` (§4.4). The summary celebrates "Studied together ✦" when the saved row comes back `together = true`.
  - If the partner disconnects mid-orbit the timer keeps running locally; on reconnect it re-syncs.
- **Activity feed:** `space_feed` items with icons and relative times; the partner's items have a **Cheer** button that sends a preset shooting star ("🔥 Nice session!", etc.).
- **Shared goals:** the shared goals list (§5.5).

### 5.5 Achievements and goals
- **AchievementsGrid:** all seeded achievements; unlocked = glowing icon + unlock date; locked = dimmed with its description. Shown on `/profile` (own) and `/profile/<partnerId>` (read-only), and as a compact "x / y unlocked" row in Our Space stat blocks.
- **Goals:** create/edit/delete own goals in a dialog: title, kind (`weekly_minutes`, `weekly_cards`, `weekly_quizzes`, `custom`), target, shared switch, due date (custom only).
  - Progress (pure `goalProgress`, unit-tested): weekly kinds use this week's totals from `get_space_stats` (week = Monday 00:00 in the viewer's timezone); personal goals count the owner only, shared goals sum both members; custom goals use the stored `progress` with − / + buttons (owner only), clamped at ≥ 0.
  - A weekly goal shows "Done this week ✓" when progress ≥ target; a custom goal sets `completed_at` when it first reaches its target. Completion plays a small check-pop/sparkle (reduced motion: static). Goals award no XP.
  - Shown on the profile, in Our Space (shared goals), and in a new dashboard widget "Current goals" (up to 3, nearest due / least complete first; empty state links to create one).

### 5.6 Navigation
- `nav.ts`: Our Space and Chat lose `phase: 2`; Market is removed; the `phase` field and the "soon" badge code are deleted. Routes: `/space`, `/chat`, `/notifications` render the new pages; `/market` is removed (falls to the 404 page). `Placeholder` remains only for the 404 route.
- Sidebar and mobile top bar get the bell; the partner avatar shows the presence dot.

### 5.7 Security notes
- New storage use is limited to `chat-files` under the sender's own folder; reads through short-lived signed URLs (members only, existing policy).
- Message text is never rendered as HTML; links are restricted to http(s) with `rel="noopener noreferrer"`.
- Message notifications contain at most 80 chars of text and go only to the other member.
- Feed and stats functions return counts and titles of already-shared items only; private quiz titles, note titles and AI conversations never leave their owner.

## 6. Error handling and edge cases
- Upload too large / disallowed type → inline error on the composer before upload; failed upload → bubble with Retry.
- Sending while offline → pending bubble; retried on reconnect or by the user.
- Deleting a message whose file removal fails → message still deleted; a console warning only.
- Notification permission denied → the switch turns itself off and Settings explains how to re-enable it in the browser.
- Partner hasn't joined yet (single member) → Our Space and Chat show a friendly "Invite your partner" state linking to Settings → Partner; no channel errors.
- Reminder refresh failure is silent (retried next load/focus); everything else surfaces a toast via the existing error mapping.
- Orbit events from an old orbit id are ignored; two simultaneous starts → the lexicographically smaller `orbitId` wins on both sides.

## 7. Testing
- **Unit (Vitest, node):** `groupMessages` (day boundaries in the viewer's timezone, clustering), `linkify` (safe schemes only), search escaping, `orbit` state machine (start/pause/resume/end, late-join sync, stale ids, simultaneous starts), `goalProgress`, presence reducer, notification-kind filter, reminder-refresh throttling, browser-notify decision (`hidden` + permission + switch).
- **Database (`rls_checks.sql`):** forged `system`/`listing` kinds and stars > 140 chars rejected; file path outside the sender's folder rejected; editing a message body refused; delete blanks body/attachment and cannot be undone; reacting to a deleted message refused; notification switched off → no row; overlapping sessions (≥ 10 min) of both members become `together`; non-overlapping stay false; `get_space_stats` / `space_feed` reveal no private titles and honour `shareActivity`; `realtime.messages` policies allow members only on `room:<id>` topics.
- **Visual:** `scripts/shoot.mjs` for `/space`, `/chat`, `/notifications`, settings sections at phone/desktop × both themes (+ reduced motion), once accounts exist (`SMOKE_EMAIL` / `SMOKE_PASSWORD` in `.env.local`).
- **Manual two-browser check** (both accounts): message + reaction + delete + search; typing; star overlay; study together through to the gold link; notification toasts and bell.

## 8. Expected advisor findings (intentional)
- `rls_enabled_no_policy` on `ai_requests`, `allowed_emails` (service-role only).
- `authenticated_security_definer_function_executable` for member RPCs: `complete_flashcard_session`, `invite_partner`, `pending_invite`, and new `get_space_stats`, `space_feed`, `refresh_reminders` — each checks membership/ownership internally.

## 9. Build order
1. Migration 13 + generated types + `rls_checks.sql` additions.
2. Realtime provider, presence, reconnect banner, partner dot.
3. Notifications: bell, page, toasts, system notifications, reminders, Settings → Notifications & Privacy.
4. Chat.
5. Our Space: sky, stats, feed, shooting stars + overlay.
6. Study together (orbit) + Study page integration.
7. Achievements grid + goals (profile, Our Space, dashboard widget).
8. Navigation clean-up (Market removal, "soon" removal), visual pass, final review.
