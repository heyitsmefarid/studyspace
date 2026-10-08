# StudySpace ✦

A private study space for two: notes, spaced-repetition flashcards, quizzes, a planner, a focus timer and **Nova**, an AI tutor. Every study session adds a star to your sky.

Built with React + TypeScript + Vite + Tailwind, backed by Supabase (Auth, Postgres with RLS, Storage, one Edge Function). AI runs server-side only: **Gemini** first, with **Groq** as the fallback.

## First-time setup checklist

1. **Supabase → Authentication → Sign In / Providers → Email:** turn **Confirm email** off. Sign-up is limited to two people, so confirmation emails add nothing. They also hit the free-tier email limit.
2. **Supabase → Edge Functions → Secrets:** add the AI secrets (see [Secrets](#edge-function-secrets)). Nova shows "add the API keys" until you do.
3. Run the app (locally or deployed) and **sign up at `/signup`**. The first account is open; that's you.
4. In **Settings → Partner**, invite your partner's email. They sign up at `/signup` with that email. After the second account, sign-up closes for good.
5. Recommended: **Authentication → Attack Protection** → enable leaked-password protection.
6. Once both accounts exist, run the security self-test: paste `supabase/tests/rls_checks.sql` into **SQL Editor** and run it. It should stop with `ERROR: RLS CHECKS PASSED`. Every change it makes is rolled back.

> Sign up yourself **before** sharing or deploying the URL. Until the first account exists, anyone who has the URL could take the first seat.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5174
```

Only the two `VITE_` values go in `.env.local`. They are public by design and are protected by row-level security. Never put AI keys or service keys in a `VITE_` variable.

## Supabase

- **Database:** migrations live in `supabase/migrations` (schema, RLS, storage buckets, gamification triggers, integrity guards, sign-up guard and the AI rate-limit reservation). Apply them in filename order.
- **Edge Function `ai`:** the shared AI code in `src/services/ai` is bundled for Deno with:

  ```bash
  npm run edge:bundle         # writes supabase/.bundle/ai (gitignored)
  supabase functions deploy ai --no-verify-jwt --project-ref <ref> # or deploy the bundle via the Supabase dashboard/connector
  ```

  The function checks every request itself (Supabase session plus StudySpace membership), so platform JWT verification stays off.

### Edge Function secrets

| Secret | Example | Notes |
|---|---|---|
| `GEMINI_API_KEY` | from Google AI Studio | primary provider |
| `GEMINI_MODEL` | `gemini-3.8-flash` | any current Flash-class model |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash-lite` | optional; attachment scans use this model when the primary fails; defaults to this value |
| `GROQ_API_KEY` | from console.groq.com | fallback provider |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | `llama-3.3-70b-versatile` also works |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` | CORS allow-list (localhost is always allowed) |
| `AI_MINUTE_LIMIT` / `AI_DAILY_LIMIT` | `15` / `200` | optional; per person, rolling window |

`SUPABASE_URL` and the service key are provided to the function automatically.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server on port 5174 |
| `npm test` | unit tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint (React Compiler rules) / TypeScript |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run check:bundle` | fails if any AI key, server secret name or provider URL reached `dist/` |
| `npm run edge:bundle` | bundles the `ai` Edge Function with its shared code |
| `npm run shoot -- /route …` | Playwright screenshots into `.shots/` (needs the dev server) |

## Deploying (Vercel)

```bash
vercel link                                      # new project "studyspace"
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel deploy --prod
```

Then:

- Set `ALLOWED_ORIGINS` to the production URL in the Edge Function secrets.
- In **Supabase → Authentication → URL Configuration**, set the Site URL to the production URL and add `<url>/set-password` as a redirect URL.

Client-side routes fall back to `index.html` through `vercel.json` (Vercel) and `public/_redirects` (Netlify).

## Free-tier notes

- Supabase pauses a free project after about 7 days without activity. Open the dashboard to restore it.
- Gemini and Groq free tiers have their own rate limits. StudySpace also caps Nova at **15 requests a minute and 200 a day per person**, and falls back to Groq when Gemini is busy.
- Storage buckets accept common document and image types only (no HTML, SVG or scripts).
