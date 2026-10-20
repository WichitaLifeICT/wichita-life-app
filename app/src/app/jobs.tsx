import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JobCard } from '@/components/job-card';
import { Button, LoadState, Screen, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { getJobs } from '@/lib/api';
import { openLink } from '@/lib/links';

const JOB_BOARD = 'https://jobs.wichitalifeict.com/';
const SHOWN = 15;

export default function JobsScreen() {
  const theme = useTheme();
  const q = useQuery(() => getJobs(SHOWN));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ Back
          </T>
        </Pressable>
      </View>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <View style={{ gap: Spacing.one }}>
          <T variant="script">Wichita jobs</T>
          <T variant="small">The {SHOWN} newest openings from the Wichita Life Job Board.</T>
        </View>

        <LoadState loading={q.loading} error={q.error} empty={q.data && !q.data.length ? 'No openings right now. Check back soon.' : undefined} />

        <View style={{ gap: Spacing.two + 2 }}>
          {q.data?.map((job) => <JobCard key={job.id} job={job} detailed />)}
        </View>

        <Sticker color={Brand.blue} shadow={Brand.orange}>
          <T variant="title" color={Brand.white}>
            Looking for more?
          </T>
          <T color="#EAF0FA">Search every opening, filter by type and pay, and get new jobs by email on the full job board.</T>
          <Button tone="orange" label="Browse all jobs ↗" onPress={() => openLink(JOB_BOARD)} />
        </Sticker>
      </Screen>
    </SafeAreaView>
  );
}
