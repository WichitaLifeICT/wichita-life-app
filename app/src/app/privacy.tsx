import { LegalPage } from '@/components/legal-page';

const CONTACT = 'wichitalifeict@gmail.com';

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 28, 2026"
      intro="Wichita Life LLC (“Wichita Life”, “we”, “us”) runs the Wichita Life app and website at app.wichitalifeict.com. This policy explains what we collect, why, who helps us run the app, and the choices you have. We never sell your personal information."
      sections={[
        {
          heading: 'What we collect',
          body: [
            [
              'Account details: your email address and the display name you choose. If you sign in with Google, we receive your name, email and profile photo link from Google. If you use Sign in with Apple, we receive your name and an email address, which may be a private relay address Apple creates.',
              'What you do in the app: searches you type, events you save, giveaways you enter, meetups you RSVP to, groups you join, the interests you pick, your votes and suggestions in Wichita votes, community board posts and replies, reports and blocks, feedback, suggestions and Spotlight nominations you send (nominations may include information about other people), your notification choices, and your invite code and who used it.',
              'Device and usage information: screens you view and buttons you tap, device type, operating system, app version, approximate location from your IP address, crash reports, and similar technical details. We use this to understand what’s useful and fix problems.',
              'Push notification token: if you allow notifications on your phone, a token that lets us send them.',
            ],
            'You can browse the app without an account. Without one we only collect the device and usage information above.',
          ],
        },
        {
          heading: 'How we use it',
          body: [
            [
              'To run your account and the features you use (saves, RSVPs, giveaway entries, the community board).',
              'To run giveaways: count entries, award bonus entries, draw winners and contact the winner by email.',
              'To share meetup details (like the venue) only with people who RSVP’d, and to let our hosts see who’s coming.',
              'To send notifications you’ve turned on, and to subscribe you to the Wichita Life newsletter when you tap Subscribe.',
              'To keep the community safe: review posts, handle reports and enforce our Terms.',
              'To improve the app using usage statistics.',
            ],
          ],
        },
        {
          heading: 'What other members can see',
          body: [
            'Other signed-in members can see your display name next to your community board posts and replies. They can’t see your email address. Meetup attendee lists are visible only to Wichita Life staff.',
          ],
        },
        {
          heading: 'Companies that help us run the app',
          body: [
            'We share information with these service providers only so they can provide their service to us:',
            [
              'Supabase: hosts our database and handles sign-in.',
              'Google: if you choose “Continue with Google”.',
              'Apple: if you choose “Sign in with Apple”.',
              'PostHog: app usage analytics and crash reports.',
              'Resend: sends our sign-in emails.',
              'beehiiv: our email newsletter, only if you subscribe.',
              'Netlify: hosts the website.',
              'Expo, Apple and Google: deliver push notifications on phones.',
            ],
            'We may also share information if the law requires it, to protect people’s safety, or as part of a sale or merger of Wichita Life (this policy would still apply to your information).',
          ],
        },
        {
          heading: 'Your choices',
          body: [
            [
              'Change your display name and notification settings any time on your Account page.',
              'Turn off push notifications in the app or in your phone’s settings.',
              'Unsubscribe from the newsletter using the link at the bottom of any email.',
              'Delete your account on the Account page. This permanently deletes your profile, saves, RSVPs, giveaway entries and board posts.',
              `Ask us for a copy of your information, or to correct or delete it, by emailing ${CONTACT}. We honor these requests from anyone, wherever you live, and answer within 30 days.`,
            ],
          ],
        },
        {
          heading: 'How long we keep it',
          body: [
            'We keep your information while your account is open. When you delete your account, we delete your profile, saves, RSVPs, giveaway entries and posts from our database right away; backups and analytics records are cleared on our providers’ normal schedules. Feedback, suggestions and nominations you sent may be kept without the link to your account; email us to have them removed too. Content already shared in our newsletter or on social media can’t be recalled. We may keep records of giveaway winners as the law requires.',
          ],
        },
        {
          heading: 'Kids',
          body: [
            'Wichita Life is meant for adults and teens 13 and older. Giveaways may have a higher age limit in their official rules. If you believe a child under 13 has created an account, email us and we’ll delete it.',
          ],
        },
        {
          heading: 'Security',
          body: [
            'Information is encrypted in transit, and our database only lets each member read and change their own private information. No system is perfectly secure, so please let us know right away if you notice anything wrong. The app doesn’t respond to browser “Do Not Track” signals, because we don’t track you across other sites or apps.',
          ],
        },
        {
          heading: 'Changes and contact',
          body: [
            `If we make important changes to this policy, we’ll update the date above and tell you in the app. Questions? Email ${CONTACT}.`,
          ],
        },
      ]}
    />
  );
}
