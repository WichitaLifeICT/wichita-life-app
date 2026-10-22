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

- A search box at the top of Explore (and a 🔍 on Events) that finds, as you type:
  upcoming **events** (title, venue), **restaurants**, **weekly specials**, **stories**, **guides** and **jobs**.
- Results grouped by type, at most 5 each with "See all"; tapping opens the usual screen.
- Built in the database (Postgres full-text search, one search function), so it's fast and works the same on web and phones.
- Tracked as `search_used` (the words people search for are gold for content ideas; we'd store the text, not who searched).
- **Decision:** include past events? Suggest no, upcoming only.

## 4. Notifications by interest ✅ can start

- Staff tools → Send a push gets an **Audience** picker: Everyone with this topic on, or only members who picked certain interests (Live music, Food & drink, Family…).
- Shows "This will reach about N people" before sending.
- Later: automatic "Picked for you this weekend" pushes on Thursday for each interest group. (Decision: do you want that, or keep pushes hand-sent?)

## 5. Suggest a weekly special ✅ can start

- "Know a happy hour or trivia night we're missing?" opens a short form: place, what it is, days, times.
- Suggestions land in Staff tools → Weekly specials as **drafts** (not shown in the app) with Approve / Delete.
- Signed-in members only, 5 suggestions a day each, so it can't be spammed.

## 6. Bonus giveaway entry for voting ✅ can start

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
- **Submit an event → straight to the form:** needs the calendar's Add Event link.
- **Spotlights:** reminder set for Oct 27.
