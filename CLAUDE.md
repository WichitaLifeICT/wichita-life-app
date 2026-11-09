# Wichita Life App

Expo (React Native) app in `app/`, Supabase backend in `supabase/`. See README.md and docs/ROADMAP.md.

## Commands
- `cd app && npx tsc --noEmit && npx eslint .`: run before every commit
- `cd app && npx expo install <pkg>`: add packages (picks SDK-compatible versions). In sandboxes without access to Expo's API, prefix with `EXPO_OFFLINE=1`.
- Database tests: apply `supabase/tests/00_supabase_stubs.sql`, the migrations, `supabase/seed.sql`, then `supabase/tests/10_rls_test.sql` (CI does this in `.github/workflows/ci.yml`).

## Conventions
- Expo SDK 58. Its APIs change between SDKs: check the installed package types in `node_modules` rather than relying on memory.
- Routes live in `app/src/app/` (Expo Router). Components, hooks and helpers live outside it.
- Brand tokens are in `app/src/constants/theme.ts`. Use them instead of literal colors or fonts.
- All data access goes through `app/src/lib/api.ts`; row types live in `app/src/lib/types.ts` and must match the SQL.
- Analytics events must be declared in `app/src/lib/analytics.ts` and documented in `docs/ANALYTICS.md`.
- Schema changes go in a new file in `supabase/migrations/`; never edit an applied migration. Add a test to `supabase/tests/10_rls_test.sql` for any new security rule.
- Always use Central time (`America/Chicago`) for everything: showing dates, "today" (`startOfWichitaDay()`), cutoffs and anything typed by staff. Use `app/src/lib/format.ts`; never the phone's local time or UTC.
- Weekly specials (trivia, karaoke, happy hours…) that Claude finds and confirms on the venue's own site or social page go live directly (`pending = false`, `verified_on` set). Ones Claude can't confirm stay `pending`. Member suggestions (`suggested_by` set) always wait for staff approval.
- Same for clubs: club updates and new clubs that Claude confirms from the club's own site, calendar, Meetup or social page are applied directly (`club_updates.status = 'applied'`, `clubs.verified_on` set). Unconfirmed ones (unknown status, possible moves, stale info) stay pending; member suggestions always wait for staff.
- Members can only read other profiles' `id, display_name, interests, role, created_at, onboarded_at` (column grants). Your own `referral_code` and `friend_code` come from the `my_codes()` RPC. Friend links use the secret `friend_code`, never the invite code.
- Pushes triggered from SQL go through `private.notify`, which drops a repeat of the same alert within 24 hours.
- Server-owned columns (`created_at`, counts, review fields) are reset on member writes by `private.server_fields()`; add new member-writable tables to its trigger list.
- Over-the-air updates: `runtimeVersion` is pinned to "1.0.0" so every store build gets them. Guard any native module added after 1.0.0 (check `TurboModuleRegistry.get(...)` and fall back), as `lib/auth.tsx` does for Google sign-in.
- Never commit `.env` or the Supabase service role key.
