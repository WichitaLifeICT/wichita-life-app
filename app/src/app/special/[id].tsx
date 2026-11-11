import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddToPlanButton } from '@/components/add-to-plan-button';
import { BackBar, Button, LoadState, Screen, Sticker, T, Tag } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { openDirections } from '@/lib/event-actions';
import { openLink } from '@/lib/links';
import {
  daysLabel,
  getWeeklySpecial,
  hoursLabel,
  isHappeningNow,
  kindOf,
  shareSpecial,
  viewFor,
  wichitaNow,
} from '@/lib/weekly';

/** One weekly special (a trivia night, a happy hour…): where shared links land. */
export default function SpecialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const track = useTrack();
  const [notice, setNotice] = useState<string>();
  const q = useQuery(() => getWeeklySpecial(id), [id]);
  const s = q.data;

  useEffect(() => {
    if (s) track('weekly_opened', { special_id: s.id, kind: s.kind, action: 'link' });
  }, [s, track]);

  const toWeekly = () => router.replace({ pathname: '/events', params: { view: s ? viewFor(s.kind) : 'weekly' } });
  const now = wichitaNow();
  const live = s ? s.days.includes(now.day) && isHappeningNow(s, now) : false;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <BackBar label="Events" onPress={() => (router.canGoBack() ? router.back() : toWeekly())} />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <LoadState
          loading={q.loading}
          error={q.error}
          empty={q.data === null ? 'This one isn’t on the list anymore.' : undefined}
        />
        {s ? (
          <>
            <Sticker color={Brand.orange} shadow={Brand.navy}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T variant="label" color={Brand.navy}>
                  {kindOf(s.kind).icon} {kindOf(s.kind).label} · every week
                </T>
                {live ? <Tag label="On now" tone="green" /> : null}
              </View>
              <T variant="heading" color={Brand.navy}>
                {s.venue}
              </T>
              <T color={Brand.navy} style={{ fontFamily: Fonts.bodySemi }}>
                {s.title}
              </T>
              <T variant="cardTitle" color={Brand.navy}>
                {daysLabel(s.days)} · {hoursLabel(s)}
              </T>
              {s.details ? <T color={Brand.navy}>{s.details}</T> : null}
            </Sticker>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              <Button
                small
                tone="red"
                label="Share"
                onPress={async () => {
                  track('weekly_opened', { special_id: s.id, kind: s.kind, action: 'share' });
                  setNotice(await shareSpecial(s));
                }}
              />
              <AddToPlanButton kind="special" id={s.id} title={`${s.title} at ${s.venue}`} />
              <Button
                small
                tone="ghost"
                label="Directions"
                onPress={() => {
                  track('weekly_opened', { special_id: s.id, kind: s.kind, action: 'directions' });
                  openDirections(s);
                }}
              />
              {s.url ? <Button small tone="ghost" label="Details ↗" onPress={() => openLink(s.url!)} /> : null}
            </View>
            {notice ? <T variant="small">{notice}</T> : null}
            {s.verified_on ? (
              <T variant="small">
                Last checked {new Date(`${s.verified_on}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                Deals change, so check with the venue before you go.
              </T>
            ) : null}
            <Button
              small
              tone="ghost"
              label={viewFor(s.kind) === 'deals' ? 'More happy hours & deals' : 'More trivia, karaoke & regulars'}
              onPress={toWeekly}
            />
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
