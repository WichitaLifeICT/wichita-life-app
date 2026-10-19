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

### Server functions

```bash
npx supabase secrets set CRON_SECRET=<long random string> \
  BEEHIIV_API_KEY=<beehiiv API key> \
  BEEHIIV_PUBLICATION_ID=<beehiiv publication id> \
  NEWS_FEEDS="KSN|https://...,KWCH|https://..."
npx supabase functions deploy sync-beehiiv --no-verify-jwt
npx supabase functions deploy sync-news --no-verify-jwt
npx supabase functions deploy send-push
```

The sync functions check `x-cron-secret` themselves, which is why they deploy with `--no-verify-jwt`.

Schedule them in the Supabase SQL editor (enable the `pg_cron` and `pg_net` extensions first):

```sql
select cron.schedule('sync-beehiiv', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/sync-beehiiv',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
$$);
select cron.schedule('sync-news', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/sync-news',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
$$);
```

Events from events.wichitalifeict.com and jobs from jobs.wichitalifeict.com need their own sync job. Which one depends on what runs those sites (a calendar feed, RSS or an API). See the roadmap.

## Checks

```bash
cd app && npx tsc --noEmit && npx eslint .
```

CI runs the same checks, plus the database security tests and `deno check` on the server functions.
