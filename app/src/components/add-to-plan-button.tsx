import { router } from 'expo-router';

import { Button } from '@/components/ui';
import { useRequireSignIn } from '@/lib/auth';
import type { PlanItemKind } from '@/lib/plans';

/** "Add to plan" for an event, weekly special, place or meetup. Members only. */
export function AddToPlanButton({
  kind,
  id,
  title,
  tone = 'ghost',
}: {
  kind: Exclude<PlanItemKind, 'note' | 'spot'>;
  id: string;
  title: string;
  tone?: 'ghost' | 'red' | 'orange';
}) {
  const requireSignIn = useRequireSignIn();
  return (
    <Button
      small
      tone={tone}
      label="+ Add to plan"
      onPress={() => {
        if (!requireSignIn('Sign in to make plans')) return;
        router.push({ pathname: '/add-to-plan', params: { kind, id, title } });
      }}
    />
  );
}
