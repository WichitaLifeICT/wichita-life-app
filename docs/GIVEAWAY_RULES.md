# Giveaway official rules

The app writes each giveaway's official rules itself, at
https://app.wichitalifeict.com/giveaway-rules?id=<giveaway id> (the "Official rules" button on the
giveaway opens it). The text lives in `app/src/app/giveaway-rules.tsx` and fills in the giveaway's
own title, prize, prize value, prize provider, start and end (Central Time), so the rules can't drift
from the giveaway.

When staff create a giveaway (Staff tools → Giveaways) they must enter the prize value; the prize
provider is optional (the business donating the prize, if any).

What the rules cover: no purchase necessary; Wichita Life LLC (PO Box 782401, Wichita, KS
67278-2401) as sponsor; Apple and Google not involved; U.S. residents 18+, one account per person;
entry period in Central Time; every bonus entry and its limit; a free email alternate method that
can match the in-app bonuses; random weighted draw within 3 days; 7-day claim window and identity
check; prize value, no cash substitute, taxes/1099; anti-cheating; publicity; releases; Kansas law;
winner's name request.

Not legal advice. Have a Kansas attorney review the text once.

## Anti-gaming built into the app

- Invite bonus counts only when the invited friend is a new account (made in the last 7 days) and
  enters the same giveaway; capped at +15.
- An invite from the same email inbox (Gmail dots, +tags) is refused.
- One basic entry per account; every bonus is once per giveaway except the daily question (once a day).
- Staff see each winner's entry count when drawing. Before awarding, check the winner's account
  isn't one of a cluster of brand-new accounts that all used the same invite code.
