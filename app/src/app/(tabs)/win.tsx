import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SignInComingSoon } from '@/components/coming-soon';
import { AppHeader, Button, Card, LoadState, Screen, SectionHeader, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { getActiveGiveaway } from '@/lib/api';
import { countdown } from '@/lib/format';
import { openLink } from '@/lib/links';

export default function WinScreen() {
  const q = useQuery(getActiveGiveaway);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const g = q.data;
  const left = g ? countdown(g.ends_at, now) : null;

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Win" />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <LoadState loading={q.loading} error={q.error} empty={q.data === null ? 'No giveaway running right now. Check back soon!' : undefined} />
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
            <Button tone="orange" label="Enter giveaway" disabled />
            <Button tone="ghost" small label="Official rules" onPress={() => openLink(g.rules_url)} />
          </Sticker>
        ) : null}

        <SignInComingSoon what="Entering and bonus entries" />

        <View style={{ gap: Spacing.two + 2 }}>
          <SectionHeader title="Bonus entries" />
          {[
            ['Share with a friend', '+3 entries when they install'],
            ['Get the email newsletter', '+1 entry'],
            ['Save a weekend event', '+1 entry'],
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
  countRow: { flexDirection: 'row', gap: Spacing.two + 2 },
  countBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 8 },
  countNum: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 26, color: Brand.white, fontVariant: ['tabular-nums'] },
  countLabel: { fontFamily: Fonts.display, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#C4CEDE' },
});
