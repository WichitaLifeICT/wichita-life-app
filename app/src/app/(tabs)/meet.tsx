import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { loadMyMeetups, MeetupCard } from '@/components/meetup-card';
import { AppHeader, Button, Chip, ChipRow, LoadState, PressableCard, Screen, SectionHeader, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getGroups, getThreads, getUpcomingMeetups } from '@/lib/api';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { activeLabel, CLUB_CATEGORIES, CLUB_LABEL, getClubs, linkLabel, type Club, type ClubCategory } from '@/lib/clubs';
import { openLink } from '@/lib/links';
import { relativeTime } from '@/lib/format';
import {
  blockMember,
  cancelRsvp,
  getMyGroupIds,
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
// Clubs show a few at a time; "All clubs" shows the rest.
const CLUBS_SHOWN = 6;

export default function MeetScreen() {
  const theme = useTheme();
  const track = useTrack();
  const { session } = useAuth();
  const userId = session?.user.id;
  const requireSignIn = useRequireSignIn();
  const [category, setCategory] = useState<ThreadCategory | 'all'>('all');
  const [menuFor, setMenuFor] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [clubCategory, setClubCategory] = useState<ClubCategory | 'all'>('all');
  const [allClubs, setAllClubs] = useState(false);
  const q = useQuery(async () => {
    const [meetups, clubs, groups, threads, { myRsvps, details }, myGroups] = await Promise.all([
      getUpcomingMeetups(),
      getClubs().catch(() => [] as Club[]),
      getGroups(),
      getThreads(),
      loadMyMeetups(!!userId),
      userId ? getMyGroupIds() : Promise.resolve(new Set<string>()),
    ]);
    return { meetups, clubs, groups, threads, myRsvps, myGroups, details, today: Date.now() };
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
  const openClub = (c: Club) => {
    track('club_opened', { club_id: c.id, category: c.category });
    openLink(c.url);
  };

  const suggest = (type: 'club' | 'group') =>
    requireSignIn('Sign in to add a club or group') && router.push({ pathname: '/suggest-club', params: { type } });

  const d = q.data;
  const clubs = (d?.clubs ?? []).filter((c) => clubCategory === 'all' || c.category === clubCategory);
  const clubCategories = CLUB_CATEGORIES.filter((c) => d?.clubs.some((x) => x.category === c.id));
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
          <T color="#EAF0FA">Meetups and dinners, clubs around town, Wichita Life groups, and a community board.</T>
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
            {q.data.meetups.map((m) => (
              <MeetupCard
                key={m.id}
                meetup={m}
                mine={d?.myRsvps[m.id]}
                place={d?.details[m.id]}
                onRsvp={() => toggleRsvp(m.id)}
              />
            ))}
          </View>
        ) : null}

        {q.data && q.data.clubs.length ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Clubs around town" action="+ Add a club" onAction={() => suggest('club')} />
            <T variant="small">Run clubs, game nights, book clubs and more that already meet in Wichita. Tap one to find their next meetup.</T>
            <ChipRow>
              <Chip label="All" active={clubCategory === 'all'} onPress={() => (setClubCategory('all'), setAllClubs(false))} />
              {clubCategories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  active={clubCategory === c.id}
                  onPress={() => (setClubCategory(c.id), setAllClubs(false))}
                />
              ))}
            </ChipRow>
            {(allClubs ? clubs : clubs.slice(0, CLUBS_SHOWN)).map((c) => (
              <PressableCard key={c.id} accessibilityRole="link" onPress={() => openClub(c)}>
                <View style={styles.between}>
                  <T variant="cardTitle" style={{ flex: 1 }}>
                    {c.name}
                  </T>
                  <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display }}>
                    {linkLabel(c.url)} ↗
                  </T>
                </View>
                <T variant="small" style={{ fontFamily: Fonts.display }} color={theme.heading}>
                  {CLUB_LABEL[c.category]}
                  {c.schedule ? ` · ${c.schedule}` : ''}
                </T>
                {c.description ? <T variant="small">{c.description}</T> : null}
                {d && activeLabel(c, d.today) ? (
                  <T variant="small" color={Brand.green}>
                    ● {activeLabel(c, d.today)}
                  </T>
                ) : null}
              </PressableCard>
            ))}
            {!allClubs && clubs.length > CLUBS_SHOWN ? (
              <Button tone="ghost" label={`All ${clubs.length} clubs`} onPress={() => setAllClubs(true)} />
            ) : null}
            <T variant="small">Times change, so check their page before you go.</T>
          </View>
        ) : null}

        {q.data ? (
          <View style={{ gap: Spacing.two + 2 }}>
            <SectionHeader title="Wichita Life groups" action="+ Start a group" onAction={() => suggest('group')} />
            <T variant="small">Groups around an interest, here in the app. Join one and you’ll get a heads-up when it has a meetup.</T>
            <View style={styles.grid}>
              {q.data.groups.map((g) => {
                const joined = Boolean(d?.myGroups.has(g.id));
                return (
                  <PressableCard
                    key={g.id}
                    style={styles.groupCard}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/group/[slug]', params: { slug: g.slug } })}>
                    <T variant="cardTitle">{g.name}</T>
                    {g.description ? <T variant="small">{g.description}</T> : null}
                    <T variant="small">{g.members.toLocaleString()} members</T>
                    <Button
                      small
                      tone={joined ? 'done' : 'ghost'}
                      label={joined ? '✓ Joined' : 'Join'}
                      onPress={() => toggleGroup(g.id)}
                    />
                  </PressableCard>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + 2 },
  groupCard: { flexBasis: '47%', flexGrow: 1 },
  guide: { borderLeftWidth: 3, paddingLeft: Spacing.two + 2 },
});
