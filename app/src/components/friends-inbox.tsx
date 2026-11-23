import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Button, Card, T } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { shortDay } from '@/lib/format';
import { getEventInbox, markEventSeen, type InboxEvent } from '@/lib/friends';
import { enablePush, getPushPermission, type PushPermission } from '@/lib/push';

/**
 * "📨 From your friends" on Today: upcoming events friends sent you that you haven't opened, with their
 * note. It's there even when the phone doesn't allow notifications (the push can only reach phones that
 * do), and it offers to turn notifications on so the next one arrives right away.
 */
export function FriendsInbox() {
  const theme = useTheme();
  const track = useTrack();
  const { session } = useAuth();
  const q = useQuery(() => (session ? getEventInbox() : Promise.resolve([] as InboxEvent[])), [session?.user.id]);
  const [opened, setOpened] = useState<string[]>([]);
  const [permission, setPermission] = useState<PushPermission>();

  useEffect(() => {
    if (session) getPushPermission().then(setPermission, () => {});
  }, [session]);

  const items = (q.data ?? []).filter((i) => !opened.includes(i.event_id));
  if (!items.length) return null;

  const open = (i: InboxEvent) => {
    setOpened((o) => [...o, i.event_id]);
    markEventSeen(i.event_id).catch(() => {});
    track('friend_event_opened', { from: 'today' });
    router.push({ pathname: '/event/[id]', params: { id: i.event_id } });
  };

  return (
    <Card style={{ gap: Spacing.two }}>
      <T variant="cardTitle">📨 From your friends</T>
      {items.map((i) => (
        <Pressable
          key={i.event_id}
          accessibilityRole="button"
          accessibilityLabel={`${i.from_name ?? 'A friend'} sent you ${i.title}`}
          onPress={() => open(i)}
          style={{ gap: 2 }}>
          <T>
            <T style={{ fontFamily: Fonts.display }}>{i.from_name ?? 'A friend'}</T> sent you{' '}
            <T style={{ fontFamily: Fonts.display }}>{i.title}</T>
          </T>
          <T variant="small">
            {shortDay(i.starts_at)}
            {i.venue ? ` · ${i.venue}` : ''}
          </T>
          {i.note ? <T variant="small">“{i.note}”</T> : null}
          <T variant="small" color={theme.link} style={{ fontFamily: Fonts.display }}>
            Take a look ›
          </T>
        </Pressable>
      ))}
      {permission === 'undetermined' ? (
        <View>
          <Button
            small
            tone="ghost"
            label="🔔 Notify me when friends send events"
            onPress={() => enablePush('friends').then((on) => setPermission(on ? 'granted' : 'denied'))}
          />
        </View>
      ) : permission === 'denied' ? (
        <View style={{ gap: Spacing.one }}>
          <T variant="small">Notifications are off for Wichita Life, so you won’t hear when friends send you things.</T>
          <Button small tone="ghost" label="🔔 Turn them on in Settings" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}
    </Card>
  );
}
