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
- [x] Meet: meetups, groups and community board (browse only)
- [x] Win: current giveaway with countdown and official rules link
- [x] Read: all posts by type, newsletter subscribe link
- [x] `sync-beehiiv` and `sync-news` server jobs
- [ ] Events sync from events.wichitalifeict.com: tell us what runs the site (calendar feed, RSS or API)
- [ ] Jobs sync from jobs.wichitalifeict.com: same question
- [ ] Pick 5–10 local news feeds for `NEWS_FEEDS`
- [ ] First TestFlight / internal test build to the dinner club

## 3. Accounts, notifications, giveaways
- [ ] Sign in with Apple, Google and email
- [ ] Onboarding: interests and the notification prompt
- [ ] Save events, with a reminder push the day before
- [ ] Enter giveaways; bonus entries verified on the server (newsletter, referral, saved event)
- [ ] Newsletter signup from the app, through the beehiiv API on the server
- [ ] Daily 7am push and the Thursday weekend guide, using `send-push`
- [ ] Small admin site (on Netlify) for giveaways, meetups, featured stories and sending pushes

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
