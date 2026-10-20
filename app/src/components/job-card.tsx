import { View } from 'react-native';

import { PressableCard, T, Tag } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';
import { relativeTime } from '@/lib/format';
import { openLink } from '@/lib/links';
import type { Job } from '@/lib/types';

/** One job post; opens the full listing on the Wichita Life Job Board. */
export function JobCard({ job, detailed }: { job: Job; detailed?: boolean }) {
  const track = useTrack();
  const meta = [job.company, detailed ? job.location : null].filter(Boolean).join(' · ');
  return (
    <PressableCard
      accessibilityRole="link"
      onPress={() => {
        track('job_opened', { url: job.url });
        openLink(job.url);
      }}>
      <T variant="small">{meta}</T>
      <T variant="cardTitle">{job.title}</T>
      {detailed ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, alignItems: 'center' }}>
          {job.job_type ? <Tag label={job.job_type} tone="blue" /> : null}
          {job.pay_text ? <Tag label={job.pay_text} tone="green" /> : null}
          <T variant="small">Posted {relativeTime(job.posted_at)} ago</T>
        </View>
      ) : job.pay_text ? (
        <T variant="small">{job.pay_text}</T>
      ) : null}
    </PressableCard>
  );
}
