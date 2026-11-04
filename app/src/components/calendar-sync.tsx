import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button, Card, SectionHeader, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';
import { canSubscribeHere, resetCalendarLink, shareCalendarLink, subscribeInCalendar } from '@/lib/calendar';
import { errorMessage } from '@/lib/format';

/** Account → "Sync with your calendar": subscribe to your plans and saved events. */
export function CalendarSync() {
  const track = useTrack();
  const [notice, setNotice] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);

  const run = (fn: () => Promise<string | void | undefined>) => {
    setNotice(undefined);
    fn().then((s) => setNotice(s || undefined), (e) => setNotice(errorMessage(e)));
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <SectionHeader title="Sync with your calendar" />
      <Card style={{ gap: Spacing.two }}>
        <T variant="small">
          Your plans and saved events show up in your phone&apos;s calendar and stay up to date when you change them.
          Calendars check for changes every hour or so.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {canSubscribeHere ? (
            <Button
              small
              tone="red"
              label="Add to Apple Calendar"
              onPress={() =>
                run(async () => {
                  track('calendar_subscribed', { how: 'subscribe' });
                  await subscribeInCalendar();
                })
              }
            />
          ) : null}
          <Button
            small
            tone={canSubscribeHere ? 'ghost' : 'red'}
            label={Platform.OS === 'web' && !canSubscribeHere ? 'Copy calendar link' : 'Share calendar link'}
            onPress={() =>
              run(async () => {
                track('calendar_subscribed', { how: 'link' });
                return shareCalendarLink();
              })
            }
          />
        </View>
        <T variant="small">
          Google Calendar: on a computer, open calendar.google.com, then Other calendars → + → From URL, and paste your
          calendar link. It shows up on your phone too.
        </T>
        <T variant="small">
          Keep the link private: anyone with it can see your plans.{' '}
          {confirmReset ? (
            <T
              variant="small"
              color={Brand.redText}
              style={{ fontFamily: Fonts.display }}
              onPress={() =>
                run(async () => {
                  setConfirmReset(false);
                  await resetCalendarLink();
                  return 'New link made. Calendars using the old one stop updating; add it again.';
                })
              }>
              Tap again to make a new link
            </T>
          ) : (
            <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display }} onPress={() => setConfirmReset(true)}>
              Make a new link
            </T>
          )}
        </T>
        {notice ? <T variant="small">{notice}</T> : null}
      </Card>
    </View>
  );
}
