import { Card, T } from '@/components/ui';

/** Shown on screens whose actions need accounts, which arrive in the next milestone. */
export function SignInComingSoon({ what }: { what: string }) {
  return (
    <Card>
      <T variant="cardTitle">Sign-in is coming in the next build</T>
      <T variant="small">You can browse now. {what} turn on once accounts are live.</T>
    </Card>
  );
}
