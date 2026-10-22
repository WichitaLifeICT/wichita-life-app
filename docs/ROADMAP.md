# Roadmap

## 1. Setup
- [x] GitHub repo, Expo app, database tables and security rules, starter content
- [x] CI: typecheck, lint, database security tests, server function checks
- [ ] Supabase project created, migration pushed, starter content loaded
- [ ] PostHog project created, key added to `app/.env`
- [ ] Apple Developer account ($99/year). A business enrollment needs a D-U-N-S number, which can take days to weeks.
- [ ] Google Play developer account ($25 one time)

## 2. Read-only app (this build)
- [x] Today: hero story, giveaway card, this weekend, news + Wichita Life feed, sponsor slot, jobs
- [x] Events: filters, grouped by day, event details, link to events.wichitalifeict.com
- [x] Live Music view (Events tab), tonight's shows on Today, genre chips from the calendar's tags
- [x] Meet: meetups, groups and community board
- [x] RSVPs with waitlist, joining groups, posting for review, report and block
- [x] Play (was Win): current giveaway with countdown and rules, plus Wichita Life Games (Wheatle, Crossroads, Troll Patrol) from games.wichitalifeict.com
- [x] Explore (was Read): all posts by type, newsletter subscribe link, local guides from wichitalifeict.com/guides (daily sync)
- [x] `sync-beehiiv` and `sync-news` server jobs
- [x] Events sync from events.wichitalifeict.com (What's Good calendar pages, every 3 hours)
- [x] Jobs sync from jobs.wichitalifeict.com (Kardow RSS feed, daily; app shows the 15 newest)
- [x] Local news: KSN, KWCH, KAKE, KMUW, Wichita Eagle, Wichita Business Journal (`news_sources` table)
- [ ] First TestFlight / internal test build to the dinner club

## 3. Accounts, notifications, giveaways
- [x] Send feedback (with Staff tools inbox) and PostHog in-app polls
- [x] Welcome screens for new members: interests and a notification prompt
- [x] Staff tools for groups and sponsors; meetup reminders the evening before (with saved-event reminders)
- [x] Crash reporting to PostHog error tracking; dashboard guide in docs/ANALYTICS.md
- [ ] Spotlights: hidden from Today/Explore until the series starts (staff can still tag them)
- [x] Weekly specials (happy hours, trivia, karaoke) on Events → Weekly, with a Today card and Staff tools page
- [ ] Sync weekly specials from the events calendar once it supports recurring events
- [x] Personalized Today: "Picked for you" from members' interests
- [x] Sign-in emails sent through Resend (notify.wichitalifeict.com)
- [x] Wichita votes ("best coffee") on Explore and Today, member suggestions, Staff tools → Votes
- [x] Submit an event button (opens the calendar's own form until the calendar API exists)
- [x] Sign in with email (link or 6-digit code) and Google
- [ ] Sign in with Apple (needs the Apple Developer account)
- [x] Account page: name, saved events, notification settings, sign out, delete account
- [ ] Onboarding: interests and the notification prompt
- [x] Save events
- [x] Reminder push the evening before a saved event (push-jobs)
- [x] Enter giveaways; saved-event bonus added by the database
- [x] Newsletter bonus (one-tap subscribe through beehiiv) and invite-a-friend bonus (+3 per friend, up to 15)
- [x] Newsletter signup from the app, through the beehiiv API on the server
- [x] Daily 7am push and the Thursday weekend guide (push-jobs)
- [x] Staff tools at /admin: board review and reports, giveaways and winner draws, meetups and attendees, featured stories, pushes

## 4. Meet
- [ ] RSVP and waitlist (the database rules already handle capacity)
- [ ] Join groups
- [ ] Board: post for review, reply, report, block
- [ ] Moderation queue in the admin site

## 5. Launch
- [ ] Privacy policy, terms, community guidelines
- [ ] Official giveaway rules ("no purchase necessary", eligibility, how winners are drawn)
- [ ] Delete-account option in the app (Apple requires it)
- [ ] Store listings, screenshots, App Store review
- [ ] Announce in the newsletter, with a launch giveaway that requires notifications to be on

## Later
- Perks and a member card, ticket sales for your own events, scavenger hunts, a daily trivia game, premium "Insider" tier
