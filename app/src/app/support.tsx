import { LegalPage } from '@/components/legal-page';

const CONTACT = 'update@wichitalifeict.com';
const MAIL = 'Wichita Life LLC, PO Box 782401, Wichita, KS 67278-2401';

/** Help & support. The App Store and Google Play listings link here as the support URL. */
export default function Support() {
  return (
    <LegalPage
      title="Help & Support"
      updated="October 29, 2026"
      intro={`Questions, problems or ideas? Email ${CONTACT} and a real person on the Wichita Life team will get back to you, usually within a day. You can also tap Send feedback on your Account page in the app.`}
      sections={[
        {
          heading: 'Contact us',
          body: [[`Email: ${CONTACT}`, `Mail: ${MAIL}`, 'In the app: Account → Send feedback']],
        },
        {
          heading: 'Signing in',
          body: [
            [
              'Sign in with Apple, Google, or your email. With email, we send a 6-digit code: type it in, or tap the link in the email on the same phone.',
              'No code? Check your spam or promotions folder, wait a minute, then tap Resend. The email comes from Wichita Life.',
              'You can browse almost everything without an account. Signing in lets you save events, enter giveaways, vote, RSVP and post.',
            ],
          ],
        },
        {
          heading: 'Notifications',
          body: [
            'Choose which notifications you get on your Account page. To turn them all off, use your phone’s Settings → Notifications → Wichita Life.',
          ],
        },
        {
          heading: 'Events and listings',
          body: [
            'Times and details come from organizers and can change, so check with the venue before you go. See something wrong or missing? Use Send feedback, or Submit an event on the Events tab.',
          ],
        },
        {
          heading: 'Giveaways',
          body: [
            'Each giveaway’s official rules are linked on the giveaway (“Official rules”). Winners are emailed at the address on their account. We will never ask you to pay anything or share bank details to claim a prize.',
          ],
        },
        {
          heading: 'Community board',
          body: [
            'Use Report on any post or reply that breaks the Community Guidelines, and Block to stop seeing someone. We review reports within 24 hours.',
          ],
        },
        {
          heading: 'Deleting your account',
          body: [
            `In the app: Account → Delete account (tap twice to confirm). This permanently deletes your profile, saves, RSVPs, giveaway entries and posts. Can’t get into the app? Email ${CONTACT} from the address on your account and we’ll delete it for you.`,
          ],
        },
        {
          heading: 'Privacy and terms',
          body: ['Read the Privacy Policy at app.wichitalifeict.com/privacy and the Terms at app.wichitalifeict.com/terms.'],
        },
      ]}
    />
  );
}
