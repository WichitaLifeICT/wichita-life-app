# App Store Connect forms: App Privacy and Age Rating

Answers for the two questionnaires in App Store Connect (Wichita Life → App Store → App Privacy, and
→ App Information → Age Rating). Checked against the app code on Nov 2, 2026. Update this file if the
app starts collecting something new (photos, location, payments...).

## App Privacy ("Get Started")

**Do you or your third-party partners collect data from this app?** Yes.

Tick these data types. For every one: **Linked to the user: Yes**, **Used for tracking: No**.

| Category | Data type | Purposes to tick | What it is in the app |
|---|---|---|---|
| Contact Info | Name | App Functionality | Display name on posts, RSVPs and giveaway entries |
| Contact Info | Email Address | App Functionality | Sign-in, and contacting giveaway winners |
| User Content | Other User Content | App Functionality | Community board posts and replies, votes, nominations, event and club suggestions |
| User Content | Customer Support | App Functionality | Send feedback notes (with an optional contact email) |
| Identifiers | User ID | App Functionality, Analytics | Account ID; PostHog analytics is tied to it after sign-in |
| Usage Data | Product Interaction | Analytics | Screens and taps sent to PostHog (e.g. event saved, vote cast) |
| Diagnostics | Crash Data | App Functionality | Crash reports in PostHog error tracking |
| Other Data | Other Data Types | App Functionality | The interests a member picks, to personalize Today |

**Do not tick:** Location, Contacts, Photos or Videos, Audio, Health & Fitness, Financial Info,
Purchases, Browsing History, Search History, Sensitive Info, Device ID, Advertising Data,
Phone Number, Physical Address.

**Tracking:** No. The app doesn't link data with other companies' data for ads and doesn't share it
with data brokers, so it needs no App Tracking Transparency prompt.

**Privacy Policy URL:** https://app.wichitalifeict.com/privacy

## Age Rating

| Question | Answer |
|---|---|
| Parental controls / age assurance | No / No |
| Unrestricted web access | No (links open in the phone's browser) |
| User-generated content | **Yes** (community board, with report, block and staff review) |
| Messaging and chat | No (no private messages; the board is public posts) |
| Advertising | No (sponsored events are local listings, not an ad network) |
| Contests / sweepstakes | **Yes** (giveaways: 18+, official rules in the app) |
| Gambling (real or simulated) | No |
| Alcohol, tobacco or drug use or references | **Infrequent / Mild** (happy hour listings, breweries, Mort's cigar bar). Choose Frequent if Apple's reviewer pushes back; it only raises the age rating. |
| Violence, horror, sexual content, nudity, profanity, mature themes | None (staff remove board posts that break the Community Guidelines) |
| Medical / treatment information | None |

Expected result: **13+**.
