# App Store and Google Play listing kit

Everything to paste into App Store Connect and the Google Play Console for the first release.
Character counts are within each store's limits.

## Basics (both stores)

| Field | Value |
| --- | --- |
| App name | **Wichita Life** |
| Seller / developer | **Wichita Life LLC** (organization account, D-U-N-S) |
| Bundle ID / package | `com.wichitalifeict.app` |
| Primary category | **Lifestyle** (Apple) · **Lifestyle** (Google) |
| Secondary category (Apple) | **News** |
| Price | Free, no in-app purchases, no ads SDK |
| Support URL | `https://wichitalifeict.com` (a contact page is better if you have one) |
| Marketing URL | `https://app.wichitalifeict.com` |
| Privacy policy URL | `https://app.wichitalifeict.com/privacy` |
| Contact email | `update@wichitalifeict.com` |
| Copyright | `2026 Wichita Life LLC` |

## Apple text

**Subtitle** (30 max, 27 used)
> Things to do in Wichita, KS

**Promotional text** (170 max; you can change it any time without a new build)
> Live music tonight, weekend plans every Thursday, happy hours and trivia nights, local news and giveaways. Your city, all in one app.

**Keywords** (100 max, 99 used; commas, no spaces after them, and don't repeat words already in the name)
> ict,things to do,events,kansas,live music,happy hour,trivia,giveaways,local news,restaurants,dinner

(If Apple counts it over 100 after edits, drop `dinner` first.)

**Description** (both stores; 4,000 max)

> Wichita Life is the all-in-one app for Wichita, from the team behind the Wichita Life newsletter that 45,000+ locals read.
>
> WHAT'S HAPPENING
> • Every event in town from the Wichita Life calendar, with free, family and food & drink filters
> • Live music tonight and this weekend, by genre
> • Weekly specials: happy hours, trivia, karaoke and open mic nights, with what's on right now
> • Save events and get a reminder the night before, add them to your calendar, share them, get directions
>
> PICKED FOR YOU
> • Tell us what you're into and Today shows the events that fit
> • Can't decide where to eat? Tap the dice for a random local spot, by cuisine
>
> YOUR CITY, EVERY DAY
> • Local headlines from Wichita news outlets, all in one feed
> • The newsletter in the app: local news Mondays and Fridays, a deep dive every Wednesday, the weekend guide every Thursday
> • Local guides and local jobs
>
> WIN STUFF AND MEET PEOPLE
> • Giveaways from local businesses, with bonus entries
> • Wichita votes: pick the city's best coffee, tacos and more
> • Meetups, groups and a community board for recommendations, questions, lost & found and free stuff
>
> PLAY
> • Wheatle, a daily five-letter word game with a Wichita twist, plus the Crossroads crossword and Troll Patrol
>
> Made in Wichita, for Wichita.

**What's new in this version** (first release)
> The first Wichita Life app: events, live music, weekly specials, local news, giveaways, votes, meetups and games, all in one place.

## Google Play text

**Short description** (80 max, 78 used)
> Events, live music, happy hours, local news and giveaways for Wichita, Kansas.

**Full description:** same as the Apple description above.

## Age rating

Answer each store's questionnaire honestly; these are the answers that apply:

- **User-generated content:** yes (community board posts and replies, votes). A new member's first post is reviewed by staff; after that posts go live and can be reported (two reports hide a post until staff review it, within 24 hours); members can block other members; there's a Community Guidelines page.
- **Alcohol references:** yes, infrequent/mild (happy hours, breweries, bar events). No sales.
- **Contests/sweepstakes:** yes, free giveaways with official rules. No purchase necessary.
- **Unrestricted web access:** no. Links open specific pages (events, news stories, tickets) in an in-app browser.
- **Violence, sexual content, profanity, gambling, medical:** none.
- **Location sharing / chat between users:** no live location; no private messaging.

Expect **13+** on Apple (user-generated content and alcohol references) and **Teen** on Google.

## Apple privacy "nutrition label"

Data used to track you across other companies' apps: **none** (no ad networks, no App Tracking Transparency prompt needed).

Data linked to you:

| Apple category | What we collect | Why |
| --- | --- | --- |
| Contact Info → Email address | Sign-in email | App functionality |
| Contact Info → Name | Display name on the board | App functionality |
| Identifiers → User ID | Account ID (also sent to PostHog) | App functionality, Analytics |
| Identifiers → Device ID | PostHog install ID and push notification token | App functionality, Analytics |
| Location → Coarse location | City-level location PostHog derives from the IP address | Analytics |
| Search History | Searches typed in the app (sent to PostHog) | Analytics |
| User Content → Other user content | Board posts and replies, votes, feedback, word suggestions | App functionality |
| Usage Data → Product interaction | Screens viewed and taps (PostHog) | Analytics |
| Diagnostics → Crash data | Crash reports (PostHog error tracking) | App functionality |
| Diagnostics → Other diagnostic data | Device type, OS and app version | Analytics |

Not collected: precise location, contacts, photos, health, financial info, browsing history, purchases.

(Contact Info → Email also covers the optional email on the feedback form and the newsletter signup.)

## Google Play "Data safety"

- **Collected:** Personal info (email address, name), Location (approximate, from IP, for analytics), App activity (app interactions, in-app search history, user-generated content), App info and performance (crash logs, diagnostics), Device or other IDs (analytics ID, push token).
- **Shared with third parties:** No (PostHog, Supabase, Resend and beehiiv process data for us as service providers, which Google doesn't count as sharing).
- **Encrypted in transit:** Yes.
- **Users can request deletion:** Yes, in the app (Account → Delete account) and by email.
- **Purposes:** App functionality, Analytics, Account management.

## Notes for Apple's reviewers

Paste into App Review Information → Notes:

> Wichita Life is a local city guide for Wichita, Kansas. Most of the app works without an account. Signing in unlocks saving events, giveaway entries, voting, meetup RSVPs and posting on the community board.
>
> Demo account: see the sign-in details above. Tap "Sign in", then "Have a password? Sign in with it", and enter them.
>
> Community board: a new member's first post is reviewed by staff; after that, posts go live immediately and can be reported. Two reports hide a post automatically until staff review it, and reports are reviewed within 24 hours. Members can report posts and replies and block other members (tap ••• on a reply, or Report / Block on a post). Community Guidelines: https://app.wichitalifeict.com/terms
>
> Giveaways are free to enter, no purchase necessary, open to U.S. residents 18+, sponsored by Wichita Life LLC (prizes may be provided by local businesses). Apple is not a sponsor and is not involved; this is stated on the giveaway itself and in the official rules linked from it.
>
> Account deletion: Account → Delete account.

## Before you submit: things still to do

1. ✅ **Sign in with Apple** is in the app. To turn it on: Supabase → Authentication → Sign In / Providers → Apple → enable, and put `com.wichitalifeict.app` in Client IDs (no secret key is needed for the iPhone app).
2. ✅ **A reviewer login.** The sign-in screen has "Have a password? Sign in with it". Create the account in Supabase → Authentication → Users → Add user → Create new user: `appreview@wichitalifeict.com`, a strong password, Auto Confirm on. Paste the same email and password into App Store Connect → App Review Information (and Google Play → App access).
3. **Screenshots.** Take them from the first test build on a real phone, not the website, so they show the real iPhone and Android tab bars. Needed: iPhone 6.9" (1320 × 2868) and Android phone (1080 × 1920 or larger), 3–8 each. Suggested set: Today; Events with Live Music; Weekly specials; Where should I eat?; Giveaway; Wichita votes; Wheatle; Community board. I'll script these so they're consistent.
4. **Remove the sample content** (giveaway, meetups, groups) and have at least one real giveaway or vote live, since reviewers try everything.
5. **Lawyer review** of the privacy policy, terms and giveaway rules. The privacy policy must mention PostHog, Supabase and Resend.
