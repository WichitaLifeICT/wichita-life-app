import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadMyMeetups, MeetupCard } from '@/components/meetup-card';
import { BOARD_RULES, ThreadCard } from '@/components/thread-card';
import { Button, LoadState, Screen, SectionHeader, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getGroup, getThreads, getUpcomingMeetups } from '@/lib/api';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { blockMember, cancelRsvp, getMyGroupIds, reportThread, rsvp, setGroupJoined } from '@/lib/member';
import type { Thread } from '@/lib/types';

/** A Wichita Life group: what it's about, Join or Leave, its upcoming meetups and its board. */
export default function GroupScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const track = useTrack();
  const { session } = useAuth();
  const userId = session?.user.id;
  const requireSignIn = useRequireSignIn();
  const [notice, setNotice] = useState<string>();
  const q = useQuery(async () => {
    const group = await getGroup(slug);
    if (!group) return { group: null };
    const [meetups, mine, myGroups, threads] = await Promise.all([
      getUpcomingMeetups(group.id),
      loadMyMeetups(!!userId),
      userId ? getMyGroupIds() : Promise.resolve(new Set<string>()),
      getThreads(50, group.id),
    ]);
    return { group, meetups, ...mine, threads, joined: myGroups.has(group.id) };
  }, [slug, userId]);

  useEffect(() => {
    track('group_opened', { slug });
  }, [slug, track]);

  const act = (fn: () => Promise<unknown>) => {
    setNotice(undefined);
    fn().then(q.refresh, (e: Error) => setNotice(e.message));
  };

  const d = q.data;
  const g = d?.group;

  const toggleJoin = () => {
    if (!g || !requireSignIn('Sign in to join groups')) return;
    const joined = !d?.joined;
    act(async () => {
      await setGroupJoined(g.id, joined);
      track('group_joined', { group_id: g.id, joined });
    });
  };

  const toggleRsvp = (meetupId: string) => {
    if (!requireSignIn('Sign in to RSVP')) return;
    const mine = d && 'myRsvps' in d ? d.myRsvps?.[meetupId] : undefined;
    act(async () => {
      if (mine) {
        await cancelRsvp(meetupId);
        track('meetup_rsvp', { meetup_id: meetupId, status: 'canceled' });
      } else {
        track('meetup_rsvp', { meetup_id: meetupId, status: await rsvp(meetupId) });
      }
    });
  };

  const newPost = () => {
    if (!g || !requireSignIn('Sign in to post')) return;
    if (!d?.joined) return setNotice(`Join ${g.name} to post on its board.`);
    router.push({ pathname: '/new-post', params: { groupId: g.id, groupName: g.name } });
  };

  const report = (t: Thread) =>
    act(async () => {
      await reportThread(t.id, 'Reported from a group board');
      track('content_reported', { kind: 'thread' });
      setNotice('Thanks. The Wichita Life team will take a look.');
    });
  const block = (t: Thread) =>
    act(async () => {
      await blockMember(t.author_id);
      setNotice(`You won't see posts from ${t.author_name} anymore.`);
    });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/meet'))}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ Meet
          </T>
        </Pressable>
      </View>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <LoadState
          loading={q.loading}
          error={q.error}
          empty={d && !g ? 'This group isn’t available anymore.' : undefined}
        />
        {g && d ? (
          <>
            <Sticker color={Brand.blue} shadow={Brand.orange}>
              <T variant="label" color={Brand.orange}>
                Wichita Life group
              </T>
              <T variant="heading" color={Brand.white}>
                {g.name}
              </T>
              {g.description ? <T color="#EAF0FA">{g.description}</T> : null}
              <T variant="small" color="#EAF0FA">
                {g.members.toLocaleString()} member{g.members === 1 ? '' : 's'}
              </T>
            </Sticker>

            <View style={{ gap: Spacing.two }}>
              <Button
                tone={d.joined ? 'done' : 'red'}
                label={d.joined ? '✓ You’re in · Leave group' : 'Join group'}
                onPress={toggleJoin}
              />
              <T variant="small">
                {d.joined
                  ? 'You’ll get a notification when this group has a new meetup.'
                  : 'Members get a notification when this group has a new meetup.'}
              </T>
              {notice ? (
                <T variant="small" color={Brand.red}>
                  {notice}
                </T>
              ) : null}
            </View>

            <View style={{ gap: Spacing.two + 2 }}>
              <SectionHeader title="Upcoming meetups" />
              {'meetups' in d && d.meetups?.length ? (
                d.meetups.map((m) => (
                  <MeetupCard
                    key={m.id}
                    meetup={m}
                    showGroup={false}
                    mine={d.myRsvps?.[m.id]}
                    place={d.details?.[m.id]}
                    onRsvp={() => toggleRsvp(m.id)}
                  />
                ))
              ) : (
                <T variant="small">Nothing on the calendar yet. Join and you’ll hear about the next one.</T>
              )}
            </View>

            <View style={{ gap: Spacing.two + 2 }}>
              <SectionHeader title="Group board" action="+ New post" onAction={newPost} />
              {'threads' in d && d.threads?.length ? (
                d.threads.map((t) => (
                  <ThreadCard key={t.id} thread={t} userId={userId} showGroup={false} onReport={report} onBlock={block} />
                ))
              ) : (
                <T variant="small">
                  No posts yet. Say hi, suggest a meetup spot, or ask who’s in for something this weekend.
                </T>
              )}
              <T variant="small">{BOARD_RULES}</T>
            </View>
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
