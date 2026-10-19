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
| `onboarding_step_viewed` | Each onboarding screen | `step` |
| `onboarding_completed` | Finishes onboarding | `interests`, `notifications` |
| `notification_permission_result` | Answers the system prompt | `granted`, `source` |
| `push_opened` | Opens the app from a push | `kind`, `target` |
| `story_opened` | Opens a Wichita Life post | `post_id`, `kind`, `from` |
| `news_opened` | Opens a local news headline | `source`, `url` |
| `event_viewed` | Opens an event | `event_id`, `from` |
| `event_saved` | Saves or unsaves an event | `event_id`, `saved` |
| `event_link_opened` | Taps tickets or details | `event_id`, `url` |
| `events_filtered` | Picks an events filter | `filter` |
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
| `newsletter_signup` | Subscribes from the app | `source` |

Events tracked in this build: `story_opened`, `news_opened`, `event_viewed`, `event_link_opened`, `events_filtered`, `job_opened`, `sponsor_clicked`. The rest arrive with accounts, onboarding and notifications (milestones 3–4).

## Dashboards to build in PostHog

- **Activation funnel:** app opened → `onboarding_completed` → `notification_permission_result` (granted) → `giveaway_entered`.
- **Weekly retention:** people who come back in week 2, 3 and 4, split by whether they turned on notifications.
- **Content:** `story_opened` by `kind`, and `news_opened` by `source`, to see which news feeds earn their place.
- **Sponsors:** `sponsor_clicked` by sponsor, for monthly sponsor reports.
- **Community:** `meetup_rsvp` going vs. canceled, and `thread_submitted` vs. `reply_posted`.

## Privacy

- No email addresses or names are sent to PostHog. Once accounts exist, people are identified by their Supabase user ID only.
- Session replay is off. If you turn it on later, mask text inputs.
- The privacy policy needs to mention PostHog before launch.
