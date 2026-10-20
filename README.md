# Wichita Life App

All of Wichita in one place: news, events, meetups, giveaways and the Wichita Life newsletter, on iPhone, Android and the web.

| Folder | What's in it |
| --- | --- |
| `app/` | The Expo (React Native) app. One codebase for iOS, Android and web. |
| `supabase/migrations/` | Database tables and security rules. |
| `supabase/seed.sql` | Starter content from the Oct 19, 2026 newsletter, plus example meetups, groups and a giveaway to edit before launch. |
| `supabase/functions/` | Server jobs: `sync-beehiiv` (posts), `sync-news` (local RSS headlines), `sync-jobs`, `sync-events`, `sync-guides`, `send-push` (notifications). |
| `supabase/tests/` | Security tests that run in CI against a real Postgres. |
| `docs/` | [Roadmap](docs/ROADMAP.md) and [analytics plan](docs/ANALYTICS.md). |

## How it fits together

- **Supabase**: accounts, the database, and scheduled jobs that keep content fresh.
- **PostHog**: product analytics (onboarding, notification opt-in, giveaway entries, RSVPs). Every event is typed in `app/src/lib/analytics.ts`.
- **beehiiv**: stays the newsletter and content system. The app reads posts from it.
- **Expo**: builds the iOS and Android apps (EAS) and delivers push notifications.
- **GitHub Actions**: typechecks and lints the app, tests the database rules, and checks the server functions on every push.

## Run the app

```bash
cd app
npm install
cp .env.example .env   # already filled in with the project's public keys
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `w` for the web version.

| Variable | Where to find it |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog → Project settings → Project API key (starts with `phc_`) |
| `EXPO_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` or `https://eu.i.posthog.com` |

These are safe to ship in the app. Never put the Supabase **service role** key in `app/.env`.

Without Supabase settings the app still runs and shows a "Connect Supabase" card on each screen. Without PostHog settings, tracking is switched off.

## Set up Supabase

```bash
npx supabase login
npx supabase init                      # once; keeps the existing migrations
npx supabase link --project-ref <your-project-ref>
npx supabase db push                   # creates tables and security rules
```

For starter content, paste `supabase/seed.sql` into the SQL editor in the Supabase dashboard and run it.

Make yourself an admin after you sign up in the app:

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

### Sign-in

Email (a link plus a 6-digit code, so it works when the email is opened on another device) and Google, through Supabase Auth. One-time setup in the Supabase dashboard:

- **Authentication → URL Configuration**: Site URL `https://wichita-life-app.netlify.app`. Redirect URLs: `https://wichita-life-app.netlify.app/**`, `wichitalife://**`, `exp://**` (Expo Go while testing).
- **Authentication → Emails → Magic Link**: include `{{ .Token }}` so the email shows the code.
- **Authentication → Sign In / Providers → Google**: client ID and secret from a Google Cloud "Web application" OAuth client whose redirect URI is `https://rbxmzybuduluzpvtgfil.supabase.co/auth/v1/callback`.
- Before launch, set up custom SMTP (Authentication → Emails → SMTP); Supabase's built-in sender only allows a few emails an hour.

Members can delete their account from the Account page (`delete-account` function), which the app stores require.

### Server functions and schedules

Deployed functions: `sync-beehiiv` (Mon, Wed, Thu and Fri just after the 6am newsletter, plus nightly), `sync-news` (twice an hour), `sync-jobs` (daily, Kardow feed), `sync-events` (every 3 hours, What's Good calendar pages), `sync-guides` (daily, wichitalifeict.com/guides), `send-push` (on demand).

- Events: the calendar has no feed, so `sync-events` reads its public event pages (schema.org Event data), allowed by its robots.txt. Its data runs one hour early compared with the times its pages show, so `_shared/listings.ts` adds the hour back (`CALENDAR_TIME_FIX_MS`).

- Newsletter types: Wednesday emails are deep dives (and only Wednesdays), the Thursday "this weekend" email is the weekend guide, other days are Daily. Spotlights are set by hand in Supabase.
- Guides: `sync-guides` reads the cards on wichitalifeict.com/guides and each guide's page tags (title, description, image). New guides show up in the app the next morning; guides removed from that page are hidden.
- The schedules live in the migrations (pg_cron + pg_net); the current times are set in `20261020014945_guides_and_schedules.sql`.
- Scheduled calls are authenticated with a random secret stored in Supabase Vault (`cron_secret`), checked by `public.verify_cron_secret()`. Nothing to configure.
- News outlets are rows in `public.news_sources` (name, feed URL, active). Add, pause or remove one there; no redeploy needed. `last_error` shows when a feed is failing. The Wichita Eagle and Wichita Business Journal block direct feed requests, so they come through Google News searches restricted to their sites.
- The only secret to set is the beehiiv key: Supabase dashboard → Edge Functions → Secrets → add `BEEHIIV_API_KEY`.

Deploy after changing a function:

```bash
npx supabase functions deploy sync-beehiiv --no-verify-jwt
npx supabase functions deploy sync-news --no-verify-jwt
npx supabase functions deploy sync-jobs --no-verify-jwt
npx supabase functions deploy sync-events --no-verify-jwt
npx supabase functions deploy sync-guides --no-verify-jwt
npx supabase functions deploy send-push --no-verify-jwt   # checks staff sessions itself
npx supabase functions deploy delete-account --no-verify-jwt   # checks the member's session itself
```


## Checks

```bash
cd app && npx tsc --noEmit && npx eslint .
```

CI runs the same checks, plus the database security tests and `deno check` on the server functions.
