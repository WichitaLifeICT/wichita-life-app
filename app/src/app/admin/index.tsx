import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { PressableCard, T, Tag } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { countPendingSuggestions, getAdminClubs, getAdminGroups, getAdminWeekly, getFeedback, getOpenReports, getThreadsForReview } from '@/lib/admin';

const SECTIONS: { href: Href; title: string; sub: string }[] = [
  { href: '/admin/board', title: 'Community board', sub: 'Approve new posts, handle reports' },
  { href: '/admin/polls', title: 'Votes', sub: 'Run “best of” votes, approve suggestions' },
  { href: '/admin/giveaways', title: 'Giveaways', sub: 'Create, edit and draw winners' },
  { href: '/admin/meetups', title: 'Meetups', sub: 'Create meetups, see who’s going' },
  { href: '/admin/places', title: 'Restaurants', sub: 'The list behind “Where should I eat?”' },
  { href: '/admin/weekly', title: 'Weekly specials', sub: 'Happy hours, trivia, karaoke and other regulars' },
  { href: '/admin/clubs', title: 'Clubs', sub: 'Run clubs, game nights and other clubs around town' },
  { href: '/admin/groups', title: 'Groups', sub: 'Wichita Life interest groups, approve suggestions' },
  { href: '/admin/sponsors', title: 'Sponsors', sub: 'Sponsored cards on Today, with dates' },
  { href: '/admin/stories', title: 'Stories', sub: 'Pick the Today hero, fix story types' },
  { href: '/admin/push', title: 'Send a push', sub: 'Notify members by topic' },
  { href: '/admin/feedback', title: 'Feedback', sub: 'What people are telling us' },
];

export default function AdminHome() {
  const q = useQuery(async () => {
    const [pending, reports, feedback, suggestions, weekly, clubs, groups] = await Promise.all([
      getThreadsForReview('pending'),
      getOpenReports(),
      getFeedback('new'),
      countPendingSuggestions(),
      getAdminWeekly(),
      getAdminClubs(),
      getAdminGroups(),
    ]);
    return {
      board: pending.length + reports.length,
      feedback: feedback.length,
      suggestions,
      weekly: weekly.filter((w) => w.pending).length,
      clubs: clubs.filter((c) => c.pending).length,
      groups: groups.filter((g) => g.pending).length,
    };
  });
  return (
    <AdminPage title="Staff tools" refreshing={q.refreshing} onRefresh={q.refresh}>
      <View style={{ gap: Spacing.two + 2 }}>
        {SECTIONS.map((s) => (
          <PressableCard key={s.title} accessibilityRole="button" onPress={() => router.push(s.href)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T variant="cardTitle">{s.title}</T>
              {s.href === '/admin/board' && q.data?.board ? <Tag label={`${q.data.board} to review`} /> : null}
              {s.href === '/admin/weekly' && q.data?.weekly ? <Tag label={`${q.data.weekly} suggested`} /> : null}
              {s.href === '/admin/clubs' && q.data?.clubs ? <Tag label={`${q.data.clubs} suggested`} /> : null}
              {s.href === '/admin/groups' && q.data?.groups ? <Tag label={`${q.data.groups} suggested`} /> : null}
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
