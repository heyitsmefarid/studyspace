# StudySpace UI polish: everyday motion and light visual depth

**Status:** design approved in chat (feel: calm and magical; focus: everyday feel; look: light polish plus motion; approach: CSS-first). This written spec awaits review.
**Branch:** `feat/ui-polish`, cut from `feat/phase-1`.

## Intent

The app should feel noticeably more alive and premium every time it's used, without distracting from studying.

**What's in scope:** every screen, from sign-up to every feature (scope widened in chat). It has two layers:
1. A shared layer that every page inherits:
   - page entrances, lists that ease in, hover and press responses, loading shimmer, dialog/menu/sheet motion;
   - light depth: glow, a faint sheen on cards, gradient accents.
2. A pass over each screen with feature-specific touches (section 8): the auth sky hero, onboarding constellation, flashcard and quiz feedback, chart reveals and so on. These stay in the calm-and-magical style.

**Out of scope this round:**
- full-screen celebration overlays (level-up, achievement unlock screens)
- an animated sky behind the whole app (the auth hero is the one exception)
- any change to features or data. Layout only changes where noted in section 8, which is the auth split screen.

**Success criteria:**
1. Every page, dialog, menu, sheet, card grid and button has a consistent, calm motion vocabulary in both themes.
2. No new JavaScript dependency. Every animation uses `transform`, `opacity` or `filter` only, so mid-range phones stay smooth.
3. With `prefers-reduced-motion: reduce`, everything appears instantly with no movement.
4. Typecheck, lint and tests are green, and the bundle scan passes. Text contrast tests still pass with any new colour tokens.

## Design

### 1. Motion tokens

These live in `src/styles/tokens.css` and are exposed through Tailwind 4 `@theme`, so they work as utilities.

| Token | Value | Use |
|---|---|---|
| `--ease-soft` | `cubic-bezier(.2,.8,.2,1)` | default out-easing |
| `--ease-float` | `cubic-bezier(.34,1.25,.64,1)` | gentle overshoot for pops and toggles |
| `--dur-press` | 120ms | button press |
| `--dur-hover` | 200ms | hover and focus |
| `--dur-enter` | 320ms | element entrance |
| `--dur-page` | 420ms | page entrance |

Keyframes, also defined in `@theme` so Tailwind emits `animate-*` utilities:

| Keyframe | What it does |
|---|---|
| `page-in` | opacity 0 → 1, translateY 8px → 0, blur 2px → 0 |
| `rise-in` | opacity and translateY 6px |
| `pop-in` | opacity and scale .96 → 1 |
| `sheet-up` | translateY 100% → 0 |
| `sheet-left` / `sheet-right` | slide in from the side |
| `fade-in` / `fade-out` | opacity |
| `pop-out` | opacity and scale 1 → .97 |
| `shimmer` | background-position sweep |
| `float` | translateY ±3px, slow, infinite |

The existing `twinkle`, `rise`, `draw` and star keyframes stay.

**Reduced motion:** one global rule in `index.css` under `prefers-reduced-motion: reduce`. It collapses animation and transition durations to near zero and runs each animation once. This replaces the need for per-component checks; the existing canvas/JS checks in StarField and the count-up remain.

### 2. Page entrance

`AppShell` wraps `<Outlet />` in a `div` keyed by the deepest matched route id (`useMatches().at(-1)?.id`) and gives it the `animate-page-in` class.

- Keying by route id, not pathname, means:
  - `/notes/a` to `/notes/b` and query-string changes (planner views) don't re-animate;
  - `/tutor` to `/tutor/:id` stays mounted, which keeps the Task 23 behaviour.
- Pages outside the shell get the same class on their root: login, sign-up, onboarding, set-password.
- The study runner overlay gets a `fade-in` instead.

### 3. Staggered list entrance

There's a CSS utility class, `stagger`, for list containers:
- direct children run `rise-in` with `animation-delay: calc(var(--stagger-step, 40ms) * n)`;
- `n` comes from `:nth-child(1..12)`, and later children share the 12th delay, so long lists never wait long.

It's applied to:
- the Notes, Decks and Quizzes grids;
- the dashboard grid;
- the stats tiles;
- the Your plans grid;
- tutor conversation lists;
- planner day and Someday lists;
- results topic cards.

It's not applied to month or week calendar cells, which have too many children.

### 4. Micro-interactions (shared UI kit)

| Element | Treatment |
|---|---|
| **Button** | press `scale(.97)` (120ms). Hover lift for primary and gold. **Primary** gets a soft violet gradient (`--primary` → `--primary-2`) and a glow ring on hover. Secondary and ghost get a border or background transition. Loading spinner unchanged. |
| **Card** | static "starlit sheen": a faint radial highlight at the top-left edge via a pseudo-element, in both themes. `interactive` cards lift 2px, brighten the border and show a glow that follows the pointer (see 5). |
| **Focus** | `:focus-visible` keeps the 2px primary outline and adds a soft `0 0 0 4px var(--primary-soft)` halo that fades in. |
| **Inputs, selects, textareas** | border and halo transition on focus. |
| **Tabs** | the active tab's background and text animate in (`pop-in` on the active pill). |
| **Switch** | thumb uses `--ease-float`, and the track glows when checked. |
| **Dialog** | overlay `fade-in`/`fade-out`. Content `pop-in`/`pop-out` on desktop, `sheet-up` on phones (bottom sheet). Radix `data-state` drives enter and exit; Radix waits for the exit animation. |
| **Sheet** | `sheet-up`, `sheet-left` or `sheet-right` by side, plus overlay fade. |
| **Menu (dropdown)** | `pop-in` from the trigger side (`data-side` origin), and items get a highlight transition. |
| **Skeleton** | `animate-pulse` is replaced by a moving `shimmer` gradient (surface-2 → raised → surface-2). |
| **EmptyState** | the constellation illustration floats gently (`float`); its gold star keeps twinkling. |
| **Toasts (sonner)** | glow border. sonner's own motion stays. |
| **Progress bar and ring** | the fill animates from 0 on mount (`--dur-page`, `--ease-soft`). |

### 5. Pointer glow (the only new JavaScript)

- **Where:** a module, `src/lib/pointerGlow.ts`, installed once from `main.tsx`.
- **What it does:** one passive, rAF-throttled `pointermove` listener on `document`. It finds `event.target.closest('[data-glow]')` and sets the pointer position as `--mx` and `--my` on that element.
- **How it renders:** CSS draws a 220px radial glow at that position, shown only on `:hover`.
- **When it's off:** it does nothing on touch-only devices (`(hover: hover)` media query false) or under reduced motion.
- **Where it's used:** `Card interactive` adds `data-glow`.
- The coordinate maths is a pure function with a unit test.

### 6. Navigation accents

- **Sidebar and More sheet:** the active item gets a small glowing star marker that scales in (`pop-in`). The hover background transitions.
- **Mobile tabs:** the active tab shows a 2px top bar that scales in from the centre. The icon gets a soft drop-shadow glow in its colour.

### 7. Page header accent

`PageHeader` adds a short gradient underline (primary → gold) under the title. It draws in on mount with a `scaleX` animation from the left, and a tiny twinkling star sits at its end.

### 8. Screen by screen

Each screen inherits sections 1–7. These are the extra touches per screen. Every animation is ≤ 600ms unless it loops, and loops are slow, low-contrast and paused under reduced motion.

| Screen | Enhancements |
|---|---|
| **Sign-up, log-in, set-password** | **Desktop:** a split screen. The left half is an animated sky hero: slowly drifting dust, two named stars ("you" and "your person") with a constellation line that draws between them, and a rare shooting star (one every ~12 s). Tagline: "A study sky for two." The form sits on the right. **Phone:** a 180px sky band above the form. The card rises in, and the logo's orbit ring turns slowly. Sign-up adds a **star strength meter** for the password: five small stars light up as length and variety grow. Every password field gets show/hide. Submitting morphs the button into a loader. A wrong password gives a soft 2px shake on the form. Success flashes a small star burst, then routes on. |
| **Onboarding** | Step progress is a constellation: each step is a star that lights up and links to the next as you advance. Steps slide horizontally. The star-colour picker shows your star glowing live in a mini sky. The finish step shows your star settling into the sky before the dashboard. |
| **App shell** | The sidebar logo's orbit spins once on hover. Collapsing the sidebar animates its width. The command palette pops in over a blurred backdrop, and the highlighted result slides. The offline banner slides down. The route-error page shows a small "lost star" drifting. Phase 2 placeholder pages get a floating constellation illustration. |
| **Dashboard** | Your Sky stars appear one by one, a draw-in over ~800 ms on first paint. The greeting fades up. The streak comet's tail shimmers. Total focus and XP count up to their values. Widgets stagger in. Nova suggestions slide in. |
| **Notes** | The grid staggers in. Note cards get the hover lift and pointer glow. The pinned star twinkles. In the editor, the toolbar fades in. Autosave status morphs: a pulsing dot while saving, then a drawn check when saved. Nova panel results fade and rise in, paragraph by paragraph. |
| **Flashcards** | On the decks grid, each deck's mini constellation draws in on hover. The deck page constellation draws in on load. **Review:** the card flips in 3D with a deepening shadow. A new card slides in from the right, and a graded card leaves to the left, tinted by its grade (Again coral, Hard gold, Good violet, Easy teal). The progress bar glides. The review summary lights one star per card reviewed. |
| **Quizzes** | Choosing an answer gives instant feedback in practice mode. Correct: a teal glow and a check that pops. Wrong: a coral tint and a 2px shake, with the correct answer gently highlighted. The progress bar glides, and the timed-mode ring ticks smoothly. **Results:** the score ring fills and the number counts up, ResultsSky stars appear in sequence, and the "Supernova" perfect banner gets a slow shimmer. |
| **Tutor (Nova)** | Messages rise in. Nova's replies reveal paragraph by paragraph (≤ 8 steps, 60 ms apart). Mode chips spring when selected. The composer glows on focus, and the send button lifts when there's text. |
| **Planner** | Switching views crossfades. Task chips pop in. Completing a task draws the checkbox tick, fades the chip and strikes the title through. A dragged chip lifts with a shadow, and drop targets glow. Today's gold ring pulses once on load. **Plan with Nova:** timeline days stagger in, and the exam-day star twinkles. |
| **Study mode** | The setup card rises in. The Orbit Timer planet leaves a short fading trail. Phase changes crossfade the eclipse background (already there) and gently scale the phase label. The summary keeps its star arc and XP count-up. |
| **Stats** | Tiles stagger in. Focus bars grow from the baseline and the accuracy line draws left to right (Recharts animation on, ~700 ms, ease-out). Subject bars grow. Switching range animates between values instead of re-mounting. |
| **Settings and profile** | Sections stagger in. The star-colour swatches show a live glowing preview. The avatar has a soft ring glow. Saved fields flash a brief check. |

## Colours

There's one new token: `--primary-2`, the gradient end for primary buttons.

- Light: `#6A4BD6` (gradient from `#5443C9`). Dark: `#8B7BFF` (gradient from `#A99CFF`).
- `primary-ink` must stay ≥ 4.5:1 on both `--primary` and `--primary-2`. `tokens.test.ts` gains this check (RED first).

## Testing and verification

- **Unit:**
  - the pointer-glow coordinate function;
  - the tokens contrast test for `--primary-2`.
- **Visual:** screenshots of public pages (`/login`, `/signup`, `/set-password`). Logged-in screens are checked through temporary preview pages that render each screen's components with sample data. After you sign up, they're checked for real. The shared kit also gets a temporary component preview page (buttons, cards, dialog, sheet, menu, tabs, skeleton, empty state, page header, stagger grid). These cover phone and desktop in both themes, plus one pass with reduced motion emulated. The staggered entrance timing is checked here, since a unit test isn't practical for it. The preview is deleted after checking.
- **Gate:** typecheck, lint, tests, build and `check:bundle`. No new dependencies.

## Out of scope

- Celebrations
- A living sky behind the whole app
- Flashcard and timer effects
- Page exit animations and shared-element transitions (left for a later round, which could adopt the View Transitions API)
- Full-screen celebration overlays, and an animated sky behind the whole app (only the auth hero has one)
