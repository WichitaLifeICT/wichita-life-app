# Next up: plans

Short plans for the next features, with the decisions each one needs. ✅ = can start now,
⏳ = waiting on an account or a decision.

## 1. Store listing kit ✅ done

See `docs/STORE_LISTING.md`. Still to do before submitting: Sign in with Apple, a reviewer login,
screenshots from the first test build, removing sample content, and a lawyer's review.

## 2. Branded sign-in email ✅ done

`supabase/templates/sign-in.html`. Paste it into Supabase → Authentication → Emails → Templates
for both **Magic link** and **Confirm signup**, with the subject
`Your Wichita Life sign-in code: {{ .Token }}`.

## 3. Search ✅ done

- A magnifying glass in every tab's header opens search over upcoming **events**, **restaurants**,
  **weekly specials**, **stories**, **guides** and **jobs**, grouped by type as you type (up to 6 each).
- `search_all()` in the database: every word has to match; day names work for weekly specials ("trivia tues").
- Tracked as `search_used` with the words searched (not who searched).

## 4. Notifications by interest ✅ done

- Thursday's weekend push is personalized: members with interests get their own picks, leaving out events they hid.
- Staff tools → Send a push has a **Who gets it** picker (Everyone or chosen interests) and shows how many phones it reaches.
- Picked for you cards have a ✕: **Hide this event** or **Not into …** (drops that interest).

## 5. Suggest a weekly special ✅ done

- "Know a happy hour or trivia night we're missing?" opens a short form: place, what it is, days, times.
- Suggestions land in Staff tools → Weekly specials as **drafts** (not shown in the app) with Approve / Delete.
- Signed-in members only, 5 suggestions a day each, so it can't be spammed.

## 6. Bonus giveaway entry for voting ✅ done (+1 once per giveaway)

- Voting in a Wichita vote while a giveaway is running gives +1 entry, once per giveaway (like saving an event).
- Shown on the giveaway card as "Vote in this week's poll · +1 entry".
- **Decision:** +1 per giveaway, or +1 per vote (more votes = more entries)? Suggest once per giveaway.

## 7. Instant open ✅ can start

- The app remembers the last Today, Events and Explore it loaded and shows them immediately on launch (or with no signal), then quietly refreshes.
- A small "Updated 2h ago" note if you're offline.

## 8. Accessibility and dark-mode pass ✅ can start

- Screen-reader labels on every button and card, logical reading order, large-text check (the app should still work with iOS's biggest text size).
- Color contrast check on every screen in light and dark mode; fix anything below the standard (WCAG AA).
- Touch targets at least 44 points.

## Waiting on you ⏳

- **Sign in with Apple and a reviewer login:** after Apple approves the developer account.
- **Links that open the app** (shared event links open the app if installed): needs the Apple Team ID and the Android signing key from the first build.
- **Google check for closed restaurants:** needs the `GOOGLE_PLACES_KEY` in Supabase (reminder set for Oct 25).
- **Spotlights:** reminder set for Oct 27.
- **Push confirmed fixes to the What's Good calendar:** once there's a What's Good MCP with write access.
  Every hand-corrected event is in `public.events` with `locked_fields` set (`select title, starts_at, venue,
  locked_fields from events where locked_fields <> '{}'`). Missing games and shows are in the two
  spreadsheets in the wichita-epe-membership repo: "Wichita home games 2026-27 (verified).xlsx" and
  "Wichita performing arts 2026-27 (verified).xlsx". After the calendar matches, clear `locked_fields`.
