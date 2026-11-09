import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { PressableCard, Sticker, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import {
  countPendingSuggestions,
  getAdminClubs,
  getAdminGroups,
  getAdminWeekly,
  getClubUpdates,
  getFeedback,
  getGiveaways,
  getOpenReports,
  getPostedPlans,
  getStaffHealth,
  getThreadsForReview,
} from '@/lib/admin';

const SECTIONS: { href: Href; title: string; sub: string }[] = [
  { href: '/admin/board', title: 'Community board', sub: 'Approve new posts, handle reports' },
  { href: '/admin/plans', title: 'Plans', sub: 'Approve plans members post to “Plans around Wichita”' },
  { href: '/admin/polls', title: 'Votes', sub: 'Run “best of” votes, approve suggestions' },
  { href: '/admin/giveaways', title: 'Giveaways', sub: 'Create, edit and draw winners' },
  { href: '/admin/meetups', title: 'Meetups', sub: 'Create meetups, see who’s going' },
  { href: '/admin/places', title: 'Restaurants', sub: 'The list behind “Where should I eat?”' },
  { href: '/admin/weekly', title: 'Weekly specials', sub: 'Happy hours, trivia, karaoke and other regulars' },
  { href: '/admin/activities', title: 'Activities', sub: 'The list behind “What should we do?”' },
  { href: '/admin/clubs', title: 'Clubs', sub: 'Run clubs, game nights and other clubs around town' },
  { href: '/admin/groups', title: 'Groups', sub: 'Wichita Life interest groups, approve suggestions' },
  { href: '/admin/sponsors', title: 'Sponsors', sub: 'Sponsored cards on Today, with dates' },
  { href: '/admin/stories', title: 'Stories', sub: 'Pick the Today hero, fix story types' },
  { href: '/admin/push', title: 'Send a push', sub: 'Notify members by topic' },
  { href: '/admin/feedback', title: 'Feedback', sub: 'What people are telling us, plus Spotlight nominations' },
];

/** One thing waiting on staff; tapping it opens the page where it's handled. */
type Todo = { label: string; href?: Href };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function AdminHome() {
  const q = useQuery(async () => {
    const [pending, reports, feedback, suggestions, weekly, clubs, groups, clubUpdates, plans, giveaways, health] =
      await Promise.all([
        getThreadsForReview('pending'),
        getOpenReports(),
        getFeedback('new'),
        countPendingSuggestions(),
        getAdminWeekly(),
        getAdminClubs(),
        getAdminGroups(),
        getClubUpdates(),
        getPostedPlans(),
        getGiveaways(),
        getStaffHealth().catch(() => null),
      ]);
    const counts = {
      posts: pending.length,
      reports: reports.length,
      feedback: feedback.length,
      suggestions,
      weekly: weekly.filter((w) => w.pending).length,
      clubs: clubs.filter((c) => c.pending).length,
      clubUpdates: clubUpdates.length,
      groups: groups.filter((g) => g.pending).length,
      plans: plans.filter((p) => p.public_status === 'pending' || p.reports.length).length,
    };
    const now = Date.now();
    const toDraw = giveaways.filter((g) => !g.winner_user_id && g.entrant_count > 0 && Date.parse(g.ends_at) < now);

    // Most urgent first: broken jobs, reports, then things members are waiting on.
    const todos: Todo[] = [];
    if (health === null) todos.push({ label: 'Couldn’t check the behind-the-scenes jobs. Pull down to try again.' });
    for (const problem of health ?? []) todos.push({ label: `Behind the scenes: ${problem} Send this to Claude to fix.` });
    if (counts.reports) todos.push({ label: `${count(counts.reports, 'report', 'reports')} to look at`, href: '/admin/board' });
    if (counts.posts)
      todos.push({ label: `${count(counts.posts, 'new post', 'new posts')} waiting for approval`, href: '/admin/board' });
    for (const g of toDraw) todos.push({ label: `Draw a winner: ${g.title}`, href: '/admin/giveaways' });
    if (counts.plans) todos.push({ label: `${count(counts.plans, 'plan', 'plans')} to review`, href: '/admin/plans' });
    if (counts.weekly)
      todos.push({ label: `${count(counts.weekly, 'weekly special', 'weekly specials')} suggested`, href: '/admin/weekly' });
    if (counts.clubs) todos.push({ label: `${count(counts.clubs, 'club', 'clubs')} suggested`, href: '/admin/clubs' });
    if (counts.clubUpdates)
      todos.push({ label: `${count(counts.clubUpdates, 'club update', 'club updates')} to review`, href: '/admin/clubs' });
    if (counts.groups) todos.push({ label: `${count(counts.groups, 'group', 'groups')} suggested`, href: '/admin/groups' });
    if (counts.suggestions)
      todos.push({ label: `${count(counts.suggestions, 'vote suggestion', 'vote suggestions')} to approve`, href: '/admin/polls' });
    if (counts.feedback)
      todos.push({ label: `${count(counts.feedback, 'new message', 'new messages')} in Feedback`, href: '/admin/feedback' });

    return {
      todos,
      board: counts.posts + counts.reports,
      feedback: counts.feedback,
      suggestions: counts.suggestions,
      weekly: counts.weekly,
      clubs: counts.clubs + counts.clubUpdates,
      groups: counts.groups,
      plans: counts.plans,
      giveaways: toDraw.length,
    };
  });
  const todos = q.data?.todos;

  return (
    <AdminPage title="Staff tools" refreshing={q.refreshing} onRefresh={q.refresh}>
      <Sticker color={Brand.orange} shadow={Brand.blue}>
        <T variant="title" color={Brand.navy}>
          {!todos ? (q.error ? 'What needs you' : 'Checking what needs you…') : todos.length ? 'What needs you' : 'All caught up'}
        </T>
        {q.error ? (
          <T color={Brand.navy}>Couldn’t check right now: {q.error.message} Pull down to try again.</T>
        ) : todos && !todos.length ? (
          <T color={Brand.navy}>Nothing to check right now.</T>
        ) : null}
        {todos?.map((t, i) =>
          t.href ? (
            <Pressable
              key={i}
              accessibilityRole="button"
              onPress={() => router.push(t.href!)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.two,
                opacity: pressed ? 0.7 : 1,
              })}>
              <T color={Brand.navy} style={{ flex: 1 }}>
                • {t.label}
              </T>
              <T color={Brand.navy} style={{ fontFamily: Fonts.display }}>
                ›
              </T>
            </Pressable>
          ) : (
            <T key={i} color={Brand.navy}>
              • {t.label}
            </T>
          ),
        )}
      </Sticker>

      <View style={{ gap: Spacing.two + 2 }}>
        {SECTIONS.map((s) => (
          <PressableCard key={s.title} accessibilityRole="button" onPress={() => router.push(s.href)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T variant="cardTitle">{s.title}</T>
              {s.href === '/admin/board' && q.data?.board ? <Tag label={`${q.data.board} to review`} /> : null}
              {s.href === '/admin/weekly' && q.data?.weekly ? <Tag label={`${q.data.weekly} suggested`} /> : null}
              {s.href === '/admin/clubs' && q.data?.clubs ? <Tag label={`${q.data.clubs} to review`} /> : null}
              {s.href === '/admin/groups' && q.data?.groups ? <Tag label={`${q.data.groups} suggested`} /> : null}
              {s.href === '/admin/plans' && q.data?.plans ? <Tag label={`${q.data.plans} to review`} /> : null}
              {s.href === '/admin/giveaways' && q.data?.giveaways ? (
                <Tag label={`${q.data.giveaways} to draw`} />
              ) : null}
              {s.href === '/admin/polls' && q.data?.suggestions ? (
                <Tag label={`${q.data.suggestions} suggested`} />
              ) : null}
              {s.href === '/admin/feedback' && q.data?.feedback ? <Tag label={`${q.data.feedback} new`} /> : null}
            </View>
            <T variant="small">{s.sub}</T>
          </PressableCard>
        ))}
      </View>
    </AdminPage>
  );
}
