import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ShowsByDay } from '@/components/live-music';
import { Chip, ChipRow, LoadState, PressableCard, SectionHeader, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { dayKey, shortDay, timeLabel } from '@/lib/format';
import { openLink } from '@/lib/links';
import { nextGameLabel, TEAMS, teamOf } from '@/lib/sports';
import type { EventItem, NewsItem } from '@/lib/types';

function byDay(events: EventItem[]) {
  const groups = new Map<string, EventItem[]>();
  for (const e of events) {
    const k = dayKey(e.starts_at);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.values()];
}

/** Events > Sports: each local team with its next game, then games by day, then sports headlines. */
export function SportsView({
  games,
  news,
  loading,
  error,
  now,
}: {
  games: EventItem[] | undefined;
  news: NewsItem[];
  loading: boolean;
  error?: Error;
  now: Date;
}) {
  const theme = useTheme();
  const track = useTrack();
  const [team, setTeam] = useState<string>('all');
  const all = useMemo(() => games ?? [], [games]);
  const next = useMemo(
    () => Object.fromEntries(TEAMS.map((t) => [t.id, all.find((e) => teamOf(e)?.id === t.id)])),
    [all],
  );
  const shown = all.filter((e) => team === 'all' || (team === 'other' ? !teamOf(e) : teamOf(e)?.id === team));
  const pick = (id: string) => {
    setTeam(id);
    track('events_filtered', { filter: `sports:${id}` });
  };

  return (
    <>
      <View style={{ gap: Spacing.two }}>
        {TEAMS.map((t) => {
          const g = next[t.id];
          const active = team === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => pick(active ? 'all' : t.id)}
              style={[
                styles.team,
                { backgroundColor: active ? Brand.navy : theme.card, borderColor: active ? Brand.navy : theme.line },
              ]}>
              <T style={{ fontSize: 26 }}>{t.icon}</T>
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="cardTitle" color={active ? Brand.white : undefined}>
                  {t.name}
                </T>
                <T variant="small" color={active ? '#DFE6F2' : undefined}>
                  {t.plays}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end', maxWidth: 170 }}>
                {g ? (
                  <>
                    <T style={[styles.next, { color: active ? Brand.orange : Brand.red }]}>{nextGameLabel(g.starts_at, now)}</T>
                    <T variant="small" color={active ? '#DFE6F2' : undefined}>
                      {shortDay(g.starts_at)} · {timeLabel(g.starts_at, g.all_day)}
                    </T>
                  </>
                ) : (
                  <T variant="small" color={active ? '#DFE6F2' : undefined} style={{ textAlign: 'right' }}>
                    No games on the calendar yet
                  </T>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ChipRow>
        <Chip label="All games" active={team === 'all'} onPress={() => pick('all')} />
        {TEAMS.map((t) => (
          <Chip key={t.id} label={`${t.icon} ${t.name.replace(/^Wichita (State )?/, '')}`} active={team === t.id} onPress={() => pick(t.id)} />
        ))}
        <Chip label="Other" active={team === 'other'} onPress={() => pick('other')} />
      </ChipRow>

      <LoadState
        loading={loading}
        error={error}
        empty={games && !shown.length ? 'No games on the calendar for this one yet.' : undefined}
      />
      <ShowsByDay days={byDay(shown)} />

      {news.length ? (
        <View style={{ gap: Spacing.two }}>
          <SectionHeader title="Sports headlines" />
          {news.slice(0, 6).map((n) => (
            <PressableCard key={n.id} accessibilityRole="link" onPress={() => openLink(n.url)}>
              <T variant="small">{n.source_name}</T>
              <T variant="cardTitle">{n.title}</T>
            </PressableCard>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  team: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  next: { fontFamily: Fonts.display, fontSize: 12.5, textAlign: 'right' },
});
