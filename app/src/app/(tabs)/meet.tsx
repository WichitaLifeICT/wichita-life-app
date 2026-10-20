import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader, Button, Card, Chip, ChipRow, LoadState, PressableCard, Screen, SectionHeader, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getGroups, getThreads, getUpcomingMeetups } from '@/lib/api';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { relativeTime, shortDay, timeLabel } from '@/lib/format';
import {
  blockMember,
  cancelRsvp,
  getMeetupDetails,
  getMyGroupIds,
  getMyRsvps,
  reportThread,
  rsvp,
  setGroupJoined,
} from '@/lib/member';
import type { Thread, ThreadCategory } from '@/lib/types';

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
  const track = useTrack();
  const { session } = useAuth();
  const userId = session?.user.id;
  const requireSignIn = useRequireSignIn();
  const [category, setCategory] = useState<ThreadCategory | 'all'>('all');
  const [menuFor, setMenuFor] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const q = useQuery(async () => {
    const [meetups, groups, threads, myRsvps, myGroups] = await Promise.all([
      getUpcomingMeetups(),
      getGroups(),
      getThreads(),
      userId ? getMyRsvps() : Promise.resolve({} as Record<string, 'going' | 'waitlist'>),
      userId ? getMyGroupIds() : Promise.resolve(new Set<string>()),
    ]);
    // Exact venues are only readable once you're going.
    const going = Object.entries(myRsvps)
      .filter(([, s]) => s === 'going')
      .map(([id]) => id);
    const details = Object.fromEntries(
      await Promise.all(going.map(async (id) => [id, await getMeetupDetails(id)] as const)),
    );
    return { meetups, groups, threads, myRsvps, myGroups, details };
  }, [userId]);

  const act = async (fn: () => Promise<unknown>) => {
    setNotice(undefined);
    try {
      await fn();
      q.refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleRsvp = (meetupId: string) => {
    if (!requireSignIn('Sign in to RSVP')) return;
    const mine = q.data?.myRsvps[meetupId];
    act(async () => {
      if (mine) {
        await cancelRsvp(meetupId);
        track('meetup_rsvp', { meetup_id: meetupId, status: 'canceled' });
      } else {
        const status = await rsvp(meetupId);
        track('meetup_rsvp', { meetup_id: meetupId, status });
      }
    });
  };

  const toggleGroup = (groupId: string) => {
    if (!requireSignIn('Sign in to join groups')) return;
    const joined = !q.data?.myGroups.has(groupId);
    act(async () => {
      await setGroupJoined(groupId, joined);
      track('group_joined', { group_id: groupId, joined });
    });
  };

  const report = (t: Thread) => {
    setMenuFor(undefined);
    act(async () => {
      await reportThread(t.id, 'Reported from the app');
      track('content_reported', { kind: 'thread' });
      setNotice('Thanks. The Wichita Life team will take a look.');
    });
  };

  const block = (t: Thread) => {
    setMenuFor(undefined);
    act(async () => {
      await blockMember(t.author_id);
      setNotice(`You won't see posts from ${t.author_name} anymore.`);
    });
  };
  const d = q.data;
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

        {notice ? (
          <T variant="small" color={Brand.red}>
            {notice}
          </T>
        ) : null}
        <LoadState loading={q.loading} error={q.error} />

        {q.data ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Upcoming meetups" />
            {q.data.meetups.length ? null : <T variant="small">No meetups scheduled yet.</T>}
            {q.data.meetups.map((m) => {
              const left = m.capacity - m.going;
              const mine = d?.myRsvps[m.id];
              const place = d?.details[m.id];
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
                  {place ? (
                    <T variant="small" color={theme.heading}>
                      📍 {[place.venue, place.address].filter(Boolean).join(', ')}
                    </T>
                  ) : null}
                  <View style={styles.between}>
                    <T variant="small">
                      {mine === 'going' ? "You're going · " : mine === 'waitlist' ? "You're on the waitlist · " : ''}
                      {m.going} going
                    </T>
                    <Button
                      small
                      tone={mine ? 'ghost' : 'red'}
                      label={mine ? 'Cancel' : left > 0 ? 'RSVP' : 'Join waitlist'}
                      onPress={() => toggleRsvp(m.id)}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        ) : null}

        {q.data && q.data.groups.length ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Groups" />
            <View style={styles.grid}>
              {q.data.groups.map((g) => {
                const joined = Boolean(d?.myGroups.has(g.id));
                return (
                  <Card key={g.id} style={styles.groupCard}>
                    <T variant="cardTitle">{g.name}</T>
                    <T variant="small">{g.members.toLocaleString()} members</T>
                    <Button
                      small
                      tone={joined ? 'done' : 'ghost'}
                      label={joined ? '✓ Joined' : 'Join'}
                      onPress={() => toggleGroup(g.id)}
                    />
                  </Card>
                );
              })}
            </View>
          </View>
        ) : null}

        {q.data ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader
              title="Community board"
              action="+ New post"
              onAction={() => requireSignIn('Sign in to post on the board') && router.push('/new-post')}
            />
            <ChipRow>
              {CATEGORIES.map((c) => (
                <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => setCategory(c.id)} />
              ))}
            </ChipRow>
            {threads.length ? null : <T variant="small">No posts yet. Be the first!</T>}
            {threads.map((t) => (
              <PressableCard
                key={t.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/thread/[id]', params: { id: t.id } })}>
                <View style={styles.between}>
                  <T variant="small" style={{ flex: 1 }}>
                    <T variant="small" style={{ fontFamily: Fonts.display }} color={theme.heading}>
                      {CATEGORY_LABEL[t.category]}
                    </T>
                    {` · ${t.author_name} · ${relativeTime(t.created_at)}`}
                  </T>
                  {userId && t.author_id !== userId ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Report or block"
                      hitSlop={10}
                      onPress={() => setMenuFor(menuFor === t.id ? undefined : t.id)}>
                      <T variant="small" style={{ fontFamily: Fonts.display }}>
                        •••
                      </T>
                    </Pressable>
                  ) : null}
                </View>
                <T variant="cardTitle">{t.title}</T>
                {t.status === 'pending' ? (
                  <T variant="small" color={Brand.red}>
                    In review: only you can see this for now
                  </T>
                ) : null}
                <T variant="small">
                  {t.replies} {t.replies === 1 ? 'reply' : 'replies'} ›
                </T>
                {menuFor === t.id ? (
                  <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one }}>
                    <Button small tone="ghost" label="Report post" onPress={() => report(t)} />
                    <Button small tone="ghost" label={`Block ${t.author_name}`} onPress={() => block(t)} />
                  </View>
                ) : null}
              </PressableCard>
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
