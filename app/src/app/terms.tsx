import { LegalPage } from '@/components/legal-page';

const CONTACT = 'wichitalifeict@gmail.com';

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service & Community Guidelines"
      updated="October 21, 2026"
      intro="These terms apply when you use the Wichita Life app and website. By creating an account or using the app, you agree to them. If you don’t agree, please don’t use the app."
      sections={[
        {
          heading: 'Your account',
          body: [
            [
              'You must be at least 13 to use Wichita Life. Some giveaways and meetups have higher age limits.',
              'Use your real first name and last initial. One account per person.',
              'You’re responsible for what happens on your account. Tell us if you think someone else is using it.',
            ],
          ],
        },
        {
          heading: 'Community guidelines',
          body: [
            'Wichita Life is for meeting neighbors and finding good things to do. On the community board, in groups and at meetups:',
            [
              'Be kind. No harassment, hate, threats or personal attacks.',
              'Keep it local and useful. No politics, spam or selling services. Free and for-sale items from individuals are fine in that category.',
              'Don’t share other people’s private information, and don’t post anything illegal, sexual or violent.',
              'Meetups: show up if you RSVP, or cancel so someone on the waitlist can come. Be respectful to hosts and venues.',
            ],
            'Every new post is reviewed before it goes live. We may remove content, and suspend or close accounts, that break these guidelines. Use Report and Block if you see a problem.',
          ],
        },
        {
          heading: 'What you post',
          body: [
            'You own what you post. You give Wichita Life permission to show it in the app and to share it in our newsletter and social media, with your display name. Don’t post anything you don’t have the right to share.',
          ],
        },
        {
          heading: 'Giveaways',
          body: [
            'No purchase is necessary to enter or win. Each giveaway has official rules, linked on its page, covering who can enter, dates, prizes and how winners are picked. If those rules conflict with these terms, the official rules win for that giveaway. Bonus entries are added only when we can verify the action; trying to cheat (for example with fake accounts) can disqualify you.',
          ],
        },
        {
          heading: 'Events, listings and links',
          body: [
            'Event times, job listings, news and guides come from many sources and can change. Check with the organizer or employer before you go or apply. We link to other websites but aren’t responsible for them.',
          ],
        },
        {
          heading: 'Meetups',
          body: [
            'Meetups are casual get-togethers at public places. You’re responsible for your own safety and choices. Wichita Life isn’t responsible for the conduct of other attendees or for what happens at venues.',
          ],
        },
        {
          heading: 'The legal part',
          body: [
            'The app is provided “as is”. To the extent the law allows, Wichita Life isn’t liable for indirect or incidental damages arising from your use of the app, and our total liability is limited to $100. These terms are governed by the laws of the State of Kansas. We may update them; if the changes are important we’ll tell you in the app. You can stop using the app and delete your account at any time.',
          ],
        },
        {
          heading: 'Contact',
          body: [`Questions or concerns? Email ${CONTACT}.`],
        },
      ]}
    />
  );
}
