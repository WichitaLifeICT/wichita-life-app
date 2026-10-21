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

- **Authentication → URL Configuration**: Site URL `https://app.wichitalifeict.com`. Redirect URLs: `https://app.wichitalifeict.com/**`, `https://wichita-life-app.netlify.app/**`, `wichitalife://**`, `exp://**` (Expo Go while testing).
- **Authentication → Emails → Magic Link**: include `{{ .Token }}` so the email shows the code.
- **Authentication → Sign In / Providers → Google**: client ID and secret from a Google Cloud "Web application" OAuth client whose redirect URI is `https://rbxmzybuduluzpvtgfil.supabase.co/auth/v1/callback`.
- Before launch, set up custom SMTP (Authentication → Emails → SMTP); Supabase's built-in sender only allows a few emails an hour.

The web version is at https://app.wichitalifeict.com (Netlify; DNS is a CNAME at HostGator pointing `app` to `wichita-life-app.netlify.app`).

Staff tools live at `/admin` (also linked from the Account page for staff): approve board posts and handle reports, run votes, manage groups and sponsored cards, create giveaways and draw winners, create meetups and see who's going, feature a story on Today, and send pushes. Accounts whose email is in `private.staff_emails` become admins when they first sign in; to add someone, run `insert into private.staff_emails (email) values ('name@example.com');` in the Supabase SQL editor (existing accounts: also set `role` on their row in `profiles`).

Giveaway bonuses are all granted by the server: saving an event (database trigger), the newsletter (`newsletter-subscribe` function, checks beehiiv), and inviting friends (`claim_referral`, +3 per friend who joins during the giveaway, up to 15). Invite links look like `https://app.wichitalifeict.com/?ref=CODE`.

Members can delete their account from the Account page (`delete-account` function), which the app stores require.

### Feedback and polls

- **Send feedback** (Today, bottom card, and the Account page) saves to `public.feedback`. Anyone can send it; only staff can read it, in Staff tools → Feedback, with a reply-by-email button.
- **In-app polls** come from PostHog Surveys: create a *Popover* survey in PostHog and it shows in the app (web and phones) without an update. They're styled to match the app by default (`app/src/app/_layout.tsx`). Target them by screen or event in PostHog, for example after `event_saved`.

### Welcome screens

New members see a short welcome once, right after they pick their name: what's in the app, what they're into (saved to `profiles.interests`, editable on the Account page), and on phones a notification prompt that explains what they'll get before the phone asks. Skipping counts as done. `profiles.onboarded_at` records that they've seen it; clear it to show it again. The list of interests is in `app/src/lib/interests.ts`.

### Wichita votes

"Best of" votes sit at the top of the Explore tab, with a teaser card on Today. Create them in Staff tools → Votes: a question, a closing date and the options (one per line). The open vote that closes soonest is the one shown. Members get one vote each and can change it until it closes; they see the split only after voting (everyone sees it once it closes, and closed votes show their winner under "Wichita picked"). Members can suggest up to 3 missing options per vote; suggestions wait in Staff tools → Votes until you tap Add. The rules live in the database (`supabase/migrations/20261021020536_polls.sql`).

### Games

The Play tab and a daily card on Today open Wichita Life Games (games.wichitalifeict.com) full-screen inside the app: Wheatle (`#wheatle`), Crossroads (`#crossroads`, the card switches to it on Fridays) and Troll Patrol (`#troll`). The app loads `?app=1`, so the games site can hide its own header, newsletter box and footer when shown in the app. Links that leave the games site open in the browser sheet. The list lives in `app/src/lib/games.ts`.

### Phone app builds

Builds run on Expo's servers (EAS, project `fb106bf3-9bf7-4987-a4e7-295f0a305969`). In GitHub, go to Actions → **App build** → Run workflow, pick the platform and profile. `preview` makes a test build you install directly; `production` is for the stores. Needs the `EXPO_TOKEN` repository secret. Build settings live in `app/eas.json`.

Push notifications: the app asks the first time someone saves an event (or from the Account page) and stores the phone's Expo push token. `push-jobs` sends saved-event reminders at 6pm the evening before, "Today in Wichita" at 7am (not Thursdays), and the weekend guide at 7am Thursdays. Android pushes need Firebase credentials uploaded to Expo; iPhone pushes need the Apple Developer account.

### Server functions and schedules

Deployed functions: `sync-beehiiv` (Mon, Wed, Thu and Fri just after the 6am newsletter, plus nightly), `sync-news` (twice an hour), `sync-jobs` (daily, Kardow feed), `sync-events` (every 3 hours, What's Good calendar pages), `sync-guides` (daily, wichitalifeict.com/guides), `send-push` (on demand).

- Event tags: `sync-events` also saves the calendar's own tags for each event in `events.calendar_tags` ("Live Music", "Rock", "Date Night"…). The app's Live Music view, genre chips, and Free/Family/Food filters read them (plus our own `tags`). Once the calendar has an API, switch the sync to it.
- Events: the calendar has no feed, so `sync-events` reads its public event pages (schema.org Event data), allowed by its robots.txt. Its data runs one hour early compared with the times its pages show, so `_shared/listings.ts` adds the hour back (`CALENDAR_TIME_FIX_MS`).

- Newsletter types: Wednesday emails are deep dives (and only Wednesdays), the Thursday "this weekend" email is the weekend guide, other days are Daily. Spotlights are set by hand in Supabase.
- Guides: `sync-guides` reads the cards on wichitalifeict.com/guides and each guide's page tags (title, description, image). New guides show up in the app the next morning; guides removed from that page are hidden.
- The schedules live in the migrations (pg_cron + pg_net); the current times are set in `20261020014945_guides_and_schedules.sql`.
- Scheduled calls are authenticated with a random secret stored in Supabase Vault (`cron_secret`), checked by `public.verify_cron_secret()`. Nothing to configure.
- Headlines whose titles contain a word in `public.news_blocked_words` (Trump, killed, shooting, death and similar) are kept out of the app. Add or remove words in the Supabase table editor; existing headlines are re-checked right away. Whole words only, so "deadline" isn't caught by "dead".
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
npx supabase functions deploy newsletter-subscribe --no-verify-jwt   # checks the member's session itself
npx supabase functions deploy push-jobs --no-verify-jwt   # scheduled; checks the cron secret
```


## Checks

```bash
cd app && npx tsc --noEmit && npx eslint .
```

CI runs the same checks, plus the database security tests and `deno check` on the server functions.
