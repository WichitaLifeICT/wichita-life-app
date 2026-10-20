import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { PressableCard, T, Tag } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { getOpenReports, getThreadsForReview } from '@/lib/admin';

const SECTIONS: { href: Href; title: string; sub: string }[] = [
  { href: '/admin/board', title: 'Community board', sub: 'Approve new posts, handle reports' },
  { href: '/admin/giveaways', title: 'Giveaways', sub: 'Create, edit and draw winners' },
  { href: '/admin/meetups', title: 'Meetups', sub: 'Create meetups, see who’s going' },
  { href: '/admin/stories', title: 'Stories', sub: 'Pick the Today hero, fix story types' },
  { href: '/admin/push', title: 'Send a push', sub: 'Notify members by topic' },
];

export default function AdminHome() {
  const q = useQuery(async () => {
    const [pending, reports] = await Promise.all([getThreadsForReview('pending'), getOpenReports()]);
    return pending.length + reports.length;
  });
  return (
    <AdminPage title="Staff tools" refreshing={q.refreshing} onRefresh={q.refresh}>
      <View style={{ gap: Spacing.two + 2 }}>
        {SECTIONS.map((s) => (
          <PressableCard key={s.title} accessibilityRole="button" onPress={() => router.push(s.href)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T variant="cardTitle">{s.title}</T>
              {s.href === '/admin/board' && q.data ? <Tag label={`${q.data} to review`} /> : null}
            </View>
            <T variant="small">{s.sub}</T>
          </PressableCard>
        ))}
      </View>
    </AdminPage>
  );
}
