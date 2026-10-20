import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { router } from 'expo-router';

import { AppHeader, Button, Card, LoadState, Screen, SectionHeader, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { getActiveGiveaway } from '@/lib/api';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { countdown } from '@/lib/format';
import { openLink } from '@/lib/links';
import { enterGiveaway, getMyEntries } from '@/lib/member';

export default function WinScreen() {
  const track = useTrack();
  const { session } = useAuth();
  const requireSignIn = useRequireSignIn();
  const q = useQuery(async () => {
    const giveaway = await getActiveGiveaway();
    const mine = giveaway && session ? await getMyEntries(giveaway.id) : {};
    return { giveaway, mine };
  }, [session?.user.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const g = q.data?.giveaway;
  const mine = q.data?.mine ?? {};
  const entered = Boolean(mine.enter);
  const total = Object.values(mine).reduce((a, b) => a + b, 0);
  const left = g ? countdown(g.ends_at, now) : null;

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Win" />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <LoadState
          loading={q.loading}
          error={q.error}
          empty={q.data?.giveaway === null ? 'No giveaway running right now. Check back soon!' : undefined}
        />
        {g && left ? (
          <Sticker color={Brand.navy} shadow={Brand.red}>
            <T variant="label" color={Brand.orange}>
              This week&apos;s giveaway
            </T>
            <T variant="heading" color={Brand.orange}>
              {g.title}
            </T>
            <T color="#DFE6F2">{g.description ?? g.prize}</T>
            <View style={styles.countRow}>
              {(
                [
                  ['days', left.days],
                  ['hours', left.hours],
                  ['min', left.minutes],
                ] as const
              ).map(([label, n]) => (
                <View key={label} style={styles.countBox}>
                  <T style={styles.countNum}>{n}</T>
                  <T style={styles.countLabel}>{label}</T>
                </View>
              ))}
            </View>
            <T variant="small" color="#DFE6F2">
              {g.entrants.toLocaleString()} entered
            </T>
            {entered ? (
              <T variant="title" color={Brand.orange}>
                You&apos;re in! {total} {total === 1 ? 'entry' : 'entries'}
              </T>
            ) : (
              <Button
                tone="orange"
                label={busy ? 'Entering…' : 'Enter giveaway'}
                disabled={busy}
                onPress={async () => {
                  if (!requireSignIn('Sign in to enter the giveaway')) return;
                  setBusy(true);
                  setError(undefined);
                  try {
                    await enterGiveaway(g.id);
                    track('giveaway_entered', { giveaway_id: g.id });
                    q.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {error ? (
              <T variant="small" color={Brand.orange}>
                {error}
              </T>
            ) : null}
            <Button tone="ghost" small label="Official rules" onPress={() => openLink(g.rules_url)} />
          </Sticker>
        ) : null}

        <View style={{ gap: Spacing.two + 2 }}>
          <SectionHeader title="Bonus entries" />
          {!entered ? <T variant="small">Enter first, then earn extra entries.</T> : null}
          <Card style={styles.bonus}>
            <View style={{ flex: 1 }}>
              <T variant="cardTitle">Save an upcoming event</T>
              <T variant="small">+1 entry, added automatically</T>
            </View>
            {mine.save_event ? (
              <T style={styles.done}>✓ Done</T>
            ) : (
              <Button
                small
                label="Find one"
                disabled={!entered}
                onPress={() => {
                  if (g)
                    track('giveaway_bonus_started', {
                      giveaway_id: g.id,
                      kind: 'save_event',
                    });
                  router.navigate('/events');
                }}
              />
            )}
          </Card>
          {[
            ['Get the email newsletter', '+1 entry · coming soon'],
            ['Share with a friend', '+3 entries when they join · coming soon'],
          ].map(([title, sub]) => (
            <Card key={title}>
              <T variant="cardTitle">{title}</T>
              <T variant="small">{sub}</T>
            </Card>
          ))}
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  bonus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  done: { fontFamily: Fonts.display, color: Brand.green },
  countRow: { flexDirection: 'row', gap: Spacing.two + 2 },
  countBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 8,
  },
  countNum: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: Brand.white,
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#C4CEDE',
  },
});
