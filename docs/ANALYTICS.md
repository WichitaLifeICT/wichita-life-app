# Analytics plan (PostHog)

The app only sends the events listed in `app/src/lib/analytics.ts`. Adding a new event means adding it there first, so names stay consistent. Screen views are captured automatically.

The database also sends two events straight to PostHog, so they count real records rather than taps:
`account_created` (every new account) and `giveaway_entry_added` (every giveaway entry, bonus entries included;
properties `giveaway`, `giveaway_id`, `kind`, `entries` = how many were just added). Staff entries aren't sent.
The "Giveaways" dashboard is built on `giveaway_entry_added`.

The push sender (`supabase/functions/_shared/push.ts`) sends `push_sent` once per member it reaches
(`kind` = the push's topic, the same as `push_opened`'s; `job` = which push: reminders, week, weekend, tonight,
daily, plan_join, friend, plan_sent, group, staff_giveaways, staff_breaking…; `campaign` = the title of
one-to-many pushes). Comparing it with `push_opened` gives each notification's open rate.

## The link to share for the app

Use **app.wichitalifeict.com/get?from=SOURCE** (newsletter, instagram, facebook, flyer…) anywhere you'd link
the App Store. It counts the tap (`app_link_opened`, by `from` and `device`), then sends iPhones to the
App Store tagged `ct=SOURCE`, Android phones to Google Play tagged `utm_source=SOURCE` (once
`ON_GOOGLE_PLAY` is on in `app/src/app/get.tsx`), and shows computers both buttons and a QR code. Phones
that already have the app open it. Installs by source then show in App Store Connect (Analytics →
Acquisition → Campaigns, once `APPLE_PROVIDER_TOKEN` is filled in) and the Play Console.

## The questions we want answered

1. **Are subscribers installing?** Installs compared with the 45K newsletter list.
2. **Are they turning on notifications?** This is the most important number for giveaways and reminders.
3. **What brings people back each week?** Stories, events, giveaways or meetups.
4. **Is the community working?** RSVPs that show up, posts that get replies.
5. **Are sponsors getting value?** Clicks on sponsored placements.

## Events

| Event | When it fires | Properties |
| --- | --- | --- |
| `onboarding_step_viewed` | Each welcome screen | `step` |
| `onboarding_completed` | Finishes or skips the welcome | `interests`, `notifications`, `skipped`, `deals` (opted in to Giveaways & deals), `newsletter` (left the newsletter box ticked) |
| `notification_permission_result` | Answers the phone's notification prompt | `granted`, `source` |
| `deals_opted_in` | Taps "Tell me about the next giveaway" after entering | `source` |
| `push_opened` | Opens the app from a push | `kind`, `job`, `campaign`, `target` |
| `notification_pref_changed` | Flips a switch on Account → Notifications | `pref`, `on` |
| `sign_in_started` | Taps Apple, Google, Email me a code, or password Sign in | `method`, `reason` (what asked them to sign in) |
| `sign_in_code_sent` | The sign-in email went out | `resend` |
| `sign_in_failed` | Sign-in showed an error | `method`, `step`, `error` (no email addresses) |
| `sign_in_completed` | A session starts on this phone or browser (any method) | `method` (apple, google, email), `new_account` |
| `giveaway_viewed` | Sees the giveaway (Play tab, or its card on Today); once per giveaway per visit | `giveaway_id`, `from` |
| `app_link_opened` | Opens app.wichitalifeict.com/get | `from`, `device` |
| `app_store_tapped` | Taps a store button on /get (computers) | `from`, `store` |
| `story_opened` | Opens a Wichita Life post | `post_id`, `kind`, `from` |
| `news_opened` | Opens a local news headline | `source`, `url` |
| `guide_opened` | Opens a local guide | `slug` |
| `game_opened` | Opens a game | `game`, `from` |
| `event_impression` | An event card is at least half on screen (once per event and place per app visit) | `event_id`, `title`, `from` |
| `event_clicked` | Taps an event to open it (was `event_viewed` before Nov 13, 2026) | `event_id`, `title`, `from` |
| `event_saved` | Saves or unsaves an event | `event_id`, `saved` |
| `event_shared` | Shares an event | `event_id` |
| `plan_created` | Starts a plan | `from` (`plans`, `add_to_plan`) |
| `plan_item_added` | Adds something to a plan | `kind`, `new_plan` |
| `plan_shared` | Shares a plan's link | `items` |
| `plan_calendar_added` | Taps Add to calendar on a plan | `mine`, `items` |
| `calendar_subscribed` | Subscribes to their calendar feed or shares its link (Account) | `how` |
| `plan_viewed_shared` | Opens a shared plan link | `mine`, `items` |
| `plan_posted` | Posts a plan to Plans around Wichita (goes to staff review) | `items` |
| `plan_copied` | Copies a public or shared plan into their plans | `from` (`public`, `link`) |
| `plan_reported` | Reports a public plan | `plan_id` |
| `plan_joined` | Taps “I’m in” (or out) on a shared or public plan | `joining` |
| `plan_sent_to_friends` | Sends a plan to chosen friends | `friends` |
| `friend_link_shared` | Shares their friend link or shows their QR code | `how` (`link`, `qr`) |
| `friend_added` | Adds a friend from a link, or sends a request from an I’m in list | `how` (`link`, `request`) |
| `weekly_opened` | Taps Share, Directions or Details on a weekly special, or opens a shared one (`link`) | `special_id`, `kind`, `action` |
| `event_calendar_added` | Adds an event to their calendar | `event_id` |
| `event_directions` | Taps Directions | `event_id` |
| `event_link_opened` | Taps tickets or details | `event_id`, `url` |
| `events_filtered` | Picks an events or live music filter | `filter` |
| `event_submit_opened` | Taps Submit an event | `from` |
| `job_opened` | Opens a job post | `url` |
| `sponsor_clicked` | Taps a sponsored placement | `sponsor`, `placement` |
| `giveaway_entered` | Enters a giveaway | `giveaway_id` |
| `giveaway_bonus_started` | Starts a bonus-entry action | `giveaway_id`, `kind` |
| `meetup_rsvp` | RSVPs or cancels | `meetup_id`, `status` |
| `group_joined` | Joins or leaves a group | `group_id`, `joined` |
| `thread_opened` | Opens a board post | `thread_id` |
| `thread_submitted` | Submits a board post for review | `category` |
| `reply_posted` | Replies on the board | `thread_id` |
| `content_reported` | Reports a post or reply | `kind` |
| `feedback_sent` | Sends feedback | `kind` |
| `poll_voted` | Votes in a Wichita vote | `poll_id`, `changed` |
| `poll_suggested` | Suggests an option | `poll_id` |
| `newsletter_signup` | Subscribes from the app | `source` (`explore`, `giveaway`, `onboarding`) |
| `shop_opened` | Opens the Wichita Life shop (Shopify), or one product from the Explore row | `from` (explore, account), `product` (its handle, when a product was tapped) |
| `sign_in_prompt_tapped` | Taps "Sign in" on the "Make Wichita Life yours" card | `from` |

Screen views (`$screen`, with the path) and crashes (`$exception`) are captured automatically.

## Crashes and errors

The app sends crashes, unhandled errors and screens that fail to draw to PostHog **Error tracking** (left menu). A screen that crashes shows a friendly "Try again" page instead of going blank, and the crash is reported with what the person was doing.

To get alerted: Error tracking → **Alerts** (or Settings → Error tracking → Alerts) → New alert → "Issue created", sent to your email. You'll hear about each new kind of crash once, not every time it happens.

Stack traces from the web app and phone builds are minified. They still show the screen and message, which is usually enough; readable line numbers need source maps uploaded during the build (PostHog's `posthog-cli sourcemap` command with a personal API key). Worth doing once the app is in the stores.

## The dashboard

Make one dashboard in PostHog called **Wichita Life app** (Dashboards → New dashboard → Blank) and add these insights (each one: New insight, set it up as described, Save, Add to dashboard). Set the date range to "Last 30 days" unless noted.

1. **People using the app each week.** Trends → Series: `$screen`, counted as *Unique users* → Interval: Week → Date range: last 90 days.
2. **New members and the welcome screens.** Funnel → Steps: `onboarding_step_viewed` (step = welcome) → `onboarding_completed` → `notification_permission_result` (granted = true). Conversion window 1 day. Shows how many new members finish the welcome and how many say yes to notifications.
3. **Notifications turned on.** Trends → `notification_permission_result`, Unique users → Breakdown: `granted` → Display: Bar (total). Add a second chart of the same thing broken down by `source` to see which ask works best (welcome, giveaway, save event, settings).
4. **Come back next week.** Retention → Cohort: first time `$screen` → Returning: `$screen` → Weekly, 8 weeks. Then the same with a filter on people who have `notification_permission_result` granted = true, to show what notifications are worth.
5. **What people do.** Trends → series `event_clicked`, `event_saved`, `story_opened`, `news_opened`, `game_opened`, `poll_voted`, `giveaway_entered`, `meetup_rsvp` → Unique users → Display: Bar (total). One bar chart of where attention goes.
6. **Events people look at.** Trends → series `event_impression` and `event_clicked` → Breakdown: `title` → Display: Table. Impressions are how many times it was seen, clicks how many times it was opened; clicks ÷ impressions is the click-through rate. Good for "your event was seen N times and opened M times" notes to venues and promoters. (For dates before Nov 13, 2026, clicks are under `event_viewed`.)
7. **Live music vs everything else.** Trends → `events_filtered`, Breakdown: `filter`, Display: Table. Shows whether the Live Music tab and genre chips get used.
8. **Stories.** Trends → `story_opened`, Breakdown: `kind` (daily, weekend, deep, spotlight) and a second one by `from` (today, explore, push).
9. **News sources.** Trends → `news_opened`, Breakdown: `source`, Display: Table. Drop feeds nobody opens.
10. **Sponsors.** Trends → `sponsor_clicked`, Breakdown: `sponsor`, Display: Table, date range "This month". This is the monthly sponsor report number.
11. **Community.** Trends → `thread_submitted`, `reply_posted`, `meetup_rsvp` (status = going) → Weekly.
12. **Interests.** Trends → `onboarding_completed`, Breakdown: `interests`, Display: Bar (total). What new members say they're into.
13. **Crashes.** Trends → `$exception`, Unique users, Daily. Should sit near zero; a spike after a release means something broke.

Tip: on the dashboard, add a filter for `$app_version` or Platform to compare the phone apps with the website.

## Privacy

- No email addresses or names are sent to PostHog. Once accounts exist, people are identified by their Supabase user ID only.
- Session replay is off. If you turn it on later, mask text inputs.
- The privacy policy needs to mention PostHog before launch.

## Staff and test traffic
The app identifies the member every time it opens signed in, so one person's phone and browsers merge into one person. Staff accounts (role moderator or admin) and dev builds set the person property `$internal_or_test_user = true`; so does opening any page once with `?team=1` (for browsers where staff don't sign in, and Claude's screenshots). PostHog's "Internal / Test users" cohort uses it, and the project filters it out of charts by default. The PostHog project's timezone is America/Chicago.
