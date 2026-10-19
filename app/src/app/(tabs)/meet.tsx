import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SignInComingSoon } from '@/components/coming-soon';
import { AppHeader, Button, Card, Chip, ChipRow, LoadState, Screen, SectionHeader, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { getGroups, getThreads, getUpcomingMeetups } from '@/lib/api';
import { relativeTime, shortDay, timeLabel } from '@/lib/format';
import type { ThreadCategory } from '@/lib/types';

const CATEGORIES: { id: ThreadCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'ask', label: 'Ask Wichita' },
  { id: 'free_for_sale', label: 'Free & for sale' },
  { id: 'lost_found', label: 'Lost & found' },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<ThreadCategory, string>;

export default function MeetScreen() {
  const theme = useTheme();
  const [category, setCategory] = useState<ThreadCategory | 'all'>('all');
  const q = useQuery(async () => {
    const [meetups, groups, threads] = await Promise.all([getUpcomingMeetups(), getGroups(), getThreads()]);
    return { meetups, groups, threads };
  });
  const threads = (q.data?.threads ?? []).filter((t) => category === 'all' || t.category === category);

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Meet" />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <Sticker color={Brand.blue} shadow={Brand.orange}>
          <T variant="label" color={Brand.orange}>
            Meet Wichita
          </T>
          <T variant="heading" color={Brand.white}>
            Make friends{' '}
            <T variant="script" color={Brand.orange} style={{ fontSize: 30 }}>
              in real life.
            </T>
          </T>
          <T color="#EAF0FA">Small meetups hosted by Wichita Life, interest groups, and a community board.</T>
        </Sticker>

        <SignInComingSoon what="RSVPs, groups and posting" />
        <LoadState loading={q.loading} error={q.error} />

        {q.data ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Upcoming meetups" />
            {q.data.meetups.length ? null : <T variant="small">No meetups scheduled yet.</T>}
            {q.data.meetups.map((m) => {
              const left = m.capacity - m.going;
              return (
                <Card key={m.id} style={{ gap: Spacing.two }}>
                  <View style={styles.between}>
                    <T variant="cardTitle" style={{ flex: 1 }}>
                      {m.title}
                    </T>
                    <T style={styles.seats}>{left > 0 ? `${left} spots left` : 'Waitlist'}</T>
                  </View>
                  <T variant="small">
                    {shortDay(m.starts_at)} · {timeLabel(m.starts_at)} · {m.area}
                  </T>
                  <View style={styles.between}>
                    <T variant="small">{m.going} going</T>
                    <Button small tone="red" label={left > 0 ? 'RSVP' : 'Join waitlist'} disabled />
                  </View>
                </Card>
              );
            })}
          </View>
        ) : null}

        {q.data?.groups.length ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Groups" />
            <View style={styles.grid}>
              {q.data.groups.map((g) => (
                <Card key={g.id} style={styles.groupCard}>
                  <T variant="cardTitle">{g.name}</T>
                  <T variant="small">{g.members.toLocaleString()} members</T>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {q.data ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Community board" />
            <ChipRow>
              {CATEGORIES.map((c) => (
                <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => setCategory(c.id)} />
              ))}
            </ChipRow>
            {threads.length ? null : <T variant="small">No posts yet. Be the first once sign-in is live.</T>}
            {threads.map((t) => (
              <Card key={t.id}>
                <T variant="small">
                  <T variant="small" style={{ fontFamily: Fonts.display }} color={theme.heading}>
                    {CATEGORY_LABEL[t.category]}
                  </T>
                  {` · ${t.author_name} · ${relativeTime(t.created_at)}`}
                </T>
                <T variant="cardTitle">{t.title}</T>
                <T variant="small">{t.replies} replies</T>
              </Card>
            ))}
            <T variant="small" style={[styles.guide, { borderColor: Brand.orange }]}>
              Real names, be kind, no politics or selling services. Every post is reviewed before it goes live.
            </T>
          </View>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  seats: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: Brand.red },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + 2 },
  groupCard: { flexBasis: '47%', flexGrow: 1 },
  guide: { borderLeftWidth: 3, paddingLeft: Spacing.two + 2 },
});
