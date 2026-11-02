import { router } from 'expo-router';
import { View } from 'react-native';

import { PressableCard, T, Tag } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { friendsSaved, getFriends, namesLabel } from '@/lib/friends';

/** The Friends entry on Meet: how many friends you have and any requests waiting. */
export function FriendsCard() {
  const { session } = useAuth();
  const q = useQuery(() => (session ? getFriends() : Promise.resolve([])), [session?.user.id]);
  const friends = (q.data ?? []).filter((f) => f.status === 'friend').length;
  const requests = (q.data ?? []).filter((f) => f.status === 'incoming').length;
  return (
    <PressableCard
      accessibilityRole="button"
      onPress={() => router.push('/friends')}
      style={{ paddingVertical: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
      <T style={{ fontSize: 20 }}>👋</T>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: Fonts.display }}>Friends ›</T>
        <T variant="small">
          {!session
            ? 'Add friends, see their plans and who’s going.'
            : friends
              ? `${friends} friend${friends === 1 ? '' : 's'} · see their plans`
              : 'Add friends with your link or QR code.'}
        </T>
      </View>
      {requests ? <Tag label={`${requests} new`} /> : null}
    </PressableCard>
  );
}

/** "👋 Ana and Ben saved this" on an event, when friends saved it. */
export function FriendsSaved({ eventId }: { eventId: string }) {
  const { session } = useAuth();
  const q = useQuery(() => (session ? friendsSaved([eventId]) : Promise.resolve(new Map<string, string[]>())), [eventId, session?.user.id]);
  const label = namesLabel(q.data?.get(eventId) ?? [], 'saved this');
  return label ? (
    <T variant="small" style={{ fontFamily: Fonts.display }}>
      👋 {label}
    </T>
  ) : null;
}
