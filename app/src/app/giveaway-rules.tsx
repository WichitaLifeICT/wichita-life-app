import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { LegalPage } from '@/components/legal-page';
import { LoadState, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { getGiveawayRules } from '@/lib/api';
import type { GiveawayRules as Rules } from '@/lib/types';

const CONTACT = 'update@wichitalifeict.com';
const SPONSOR = 'Wichita Life LLC, PO Box 782401, Wichita, KS 67278-2401';

// Always Central time, like everything else in the app.
const when = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso)) + ' Central Time';
const day = (iso: string, plusDays = 0) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(Date.parse(iso) + plusDays * 86_400_000),
  );
const dollars = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0 })}`;

/** Official rules for a giveaway, written from its own dates and prize so they always match. */
export default function GiveawayRules() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useQuery(() => getGiveawayRules(id), [id]);

  if (!q.data) {
    return (
      <Screen>
        <View style={{ paddingTop: 48 }}>
          <LoadState loading={q.loading} error={q.error} empty={q.data === null ? 'No giveaway found.' : undefined} />
        </View>
      </Screen>
    );
  }
  return <RulesPage g={q.data} />;
}

function RulesPage({ g }: { g: Rules }) {
  const provider = g.prize_provider || (g.sponsor_name && g.sponsor_name !== 'Wichita Life' ? g.sponsor_name : null);
  const value = g.prize_value != null ? ` Approximate retail value: ${dollars(Number(g.prize_value))}.` : '';
  return (
    <LegalPage
      title={`${g.title}: Official Rules`}
      updated={day(g.starts_at)}
      intro="NO PURCHASE OR PAYMENT OF ANY KIND IS NECESSARY TO ENTER OR WIN. A PURCHASE WILL NOT INCREASE YOUR CHANCES OF WINNING. VOID WHERE PROHIBITED."
      sections={[
        {
          heading: '1. Sponsor',
          body: [
            `${SPONSOR} (“Sponsor”).${provider ? ` Prize provided by ${provider}.` : ''} Apple Inc. and Google LLC are not sponsors of this giveaway and are not involved in it in any way.`,
          ],
        },
        {
          heading: '2. Who can enter',
          body: [
            `Legal residents of the United States who are 18 or older when they enter. Employees of Sponsor${provider ? ` and of ${provider}` : ''}, and their immediate family and household members, can’t enter. One person, one account: entries from more than one account by the same person are all void.`,
          ],
        },
        {
          heading: '3. When',
          body: [`Starts ${when(g.starts_at)} and ends ${when(g.ends_at)} (the “Entry Period”). Sponsor’s clock is the official clock.`],
        },
        {
          heading: '4. How to enter',
          body: [
            'Sign in to the free Wichita Life app (iPhone, Android or app.wichitalifeict.com) and tap Enter giveaway for 1 entry. Limit one basic entry per person.',
          ],
        },
        {
          heading: '5. Bonus entries (optional)',
          body: [
            'After you enter, you can earn bonus entries during the Entry Period:',
            [
              'Subscribe to the free Wichita Life newsletter with your account email: +1, once.',
              'Save an upcoming event in the app: +1, once.',
              'Vote in a Wichita vote in the app: +1, once.',
              'Answer the Question of the day: +1 for each day you answer.',
              'Invite a friend: +3 for each new member who signs up with your invite code during the Entry Period and enters this giveaway, up to +15.',
            ],
            `Free alternate method: you can get bonus entries without doing any of the above. Email ${CONTACT} with the subject “${g.title} entries”, your name and the email on your account. Your first email earns 18 bonus entries (the most the one-time and invite bonuses above can earn), and each later email earns 1 more (matching the Question of the day), limit one email per person per day. You must have entered the giveaway, and emails must arrive before it ends.`,
          ],
        },
        {
          heading: '6. Picking the winner',
          body: [
            `One winner will be picked in a random drawing within 3 days after the giveaway ends, from all eligible entries, weighted by each person’s number of entries. Odds depend on how many eligible entries are received.`,
          ],
        },
        {
          heading: '7. Prize',
          body: [
            `${g.prize}.${value} No cash substitute and no transfer, except Sponsor may substitute a prize of equal or greater value. Any taxes are the winner’s responsibility; a Form 1099 will be issued if required (prizes worth $600 or more).`,
          ],
        },
        {
          heading: '8. Winner notification',
          body: [
            'The winner will be emailed at the address on their account and must reply within 7 days to claim the prize. Sponsor may ask the winner to confirm their name, age and that they live in the U.S. If the winner doesn’t reply in time, isn’t eligible, or broke these rules, an alternate winner may be drawn. Sponsor will never ask a winner to pay anything or share bank details to receive a prize.',
          ],
        },
        {
          heading: '9. Cheating',
          body: [
            'Fake or duplicate accounts, invite codes used on your own accounts, automated entries, or any other attempt to get more entries than these rules allow void all of that person’s entries and any prize. Sponsor’s decisions are final.',
          ],
        },
        {
          heading: '10. Publicity',
          body: [
            'Where the law allows, the winner agrees Sponsor may share their first name, last initial and city in the app, newsletter and on social media to announce the winner, without further payment.',
          ],
        },
        {
          heading: '11. Releases and limits',
          body: [
            `By entering, you agree to these rules and release Sponsor${provider ? `, ${provider}` : ''}, Apple and Google from liability related to the giveaway and the prize, to the extent the law allows. Sponsor isn’t responsible for technical problems, lost or late entries, or errors in the app. If fraud or a technical problem affects the giveaway, Sponsor may cancel or change it, or pick the winner from the eligible entries received before the problem.`,
          ],
        },
        { heading: '12. Law', body: ['These rules are governed by the laws of the State of Kansas.'] },
        {
          heading: '13. Winner’s name and questions',
          body: [
            `For the winner’s name (available after ${day(g.ends_at, 14)}) or any questions, email ${CONTACT} or write to ${SPONSOR}. Entry information is handled under the Wichita Life Privacy Policy at app.wichitalifeict.com/privacy.`,
          ],
        },
      ]}
    />
  );
}
