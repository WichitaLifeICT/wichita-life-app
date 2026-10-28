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
- Never commit `.env` or the Supabase service role key.
