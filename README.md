# Wichita Life App

All of Wichita in one place: news, events, meetups, giveaways and the Wichita Life newsletter, on iPhone, Android and the web.

| Folder | What's in it |
| --- | --- |
| `app/` | The Expo (React Native) app. One codebase for iOS, Android and web. |
| `supabase/migrations/` | Database tables and security rules. |
| `supabase/seed.sql` | Starter content from the Oct 19, 2026 newsletter, plus example meetups, groups and a giveaway to edit before launch. |
| `supabase/functions/` | Server jobs: `sync-beehiiv` (posts), `sync-news` (local RSS headlines), `send-push` (notifications). |
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

### Server functions and schedules

Deployed functions: `sync-beehiiv` (every 15 min), `sync-news` (twice an hour), `send-push` (on demand).

- The schedules live in `supabase/migrations/20261019201000_schedule_sync_jobs.sql` (pg_cron + pg_net).
- Scheduled calls are authenticated with a random secret stored in Supabase Vault (`cron_secret`), checked by `public.verify_cron_secret()`. Nothing to configure.
- News outlets are rows in `public.news_sources` (name, feed URL, active). Add, pause or remove one there; no redeploy needed. `last_error` shows when a feed is failing. The Wichita Eagle and Wichita Business Journal block direct feed requests, so they come through Google News searches restricted to their sites.
- The only secret to set is the beehiiv key: Supabase dashboard → Edge Functions → Secrets → add `BEEHIIV_API_KEY`.

Deploy after changing a function:

```bash
npx supabase functions deploy sync-beehiiv --no-verify-jwt
npx supabase functions deploy sync-news --no-verify-jwt
npx supabase functions deploy send-push --no-verify-jwt   # checks staff sessions itself
```

Events from events.wichitalifeict.com and jobs from jobs.wichitalifeict.com need their own sync job. Which one depends on what runs those sites (a calendar feed, RSS or an API). See the roadmap.

## Checks

```bash
cd app && npx tsc --noEmit && npx eslint .
```

CI runs the same checks, plus the database security tests and `deno check` on the server functions.
