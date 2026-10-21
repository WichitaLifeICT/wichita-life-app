# Analytics plan (PostHog)

The app only sends the events listed in `app/src/lib/analytics.ts`. Adding a new event means adding it there first, so names stay consistent. Screen views are captured automatically.

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
| `onboarding_completed` | Finishes or skips the welcome | `interests`, `notifications`, `skipped` |
| `notification_permission_result` | Answers the phone's notification prompt | `granted`, `source` |
| `push_opened` | Opens the app from a push | `kind`, `target` |
| `story_opened` | Opens a Wichita Life post | `post_id`, `kind`, `from` |
| `news_opened` | Opens a local news headline | `source`, `url` |
| `guide_opened` | Opens a local guide | `slug` |
| `game_opened` | Opens a game | `game`, `from` |
| `event_viewed` | Opens an event | `event_id`, `title`, `from` |
| `event_saved` | Saves or unsaves an event | `event_id`, `saved` |
| `event_shared` | Shares an event | `event_id` |
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
| `newsletter_signup` | Subscribes from the app | `source` |

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
5. **What people do.** Trends → series `event_viewed`, `event_saved`, `story_opened`, `news_opened`, `game_opened`, `poll_voted`, `giveaway_entered`, `meetup_rsvp` → Unique users → Display: Bar (total). One bar chart of where attention goes.
6. **Events people look at.** Trends → `event_viewed` → Breakdown: `title` → Display: Table. Good for "your event got N views in the app" notes to venues and promoters.
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
