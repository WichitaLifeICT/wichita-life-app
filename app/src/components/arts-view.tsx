import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ShowsByDay } from '@/components/live-music';
import { Chip, ChipRow, LoadState, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { ARTS_FILTERS, nextShowLabel, STAGES } from '@/lib/arts';
import { dayKey, shortDay, timeLabel } from '@/lib/format';
import type { EventItem } from '@/lib/types';

function byDay(events: EventItem[]) {
  const groups = new Map<string, EventItem[]>();
  for (const e of events) {
    const k = dayKey(e.starts_at);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.values()];
}

/** Events > Arts: the big local stages with their next show, then every show by day. */
export function ArtsView({
  shows,
  loading,
  error,
  now,
}: {
  shows: EventItem[] | undefined;
  loading: boolean;
  error?: Error;
  now: Date;
}) {
  const theme = useTheme();
  const track = useTrack();
  const [filter, setFilter] = useState<string>('all');
  const all = useMemo(() => shows ?? [], [shows]);
  const next = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.id, all.find(s.test)])), [all]);
  // Stages with a show coming up first (soonest on top), then the ones with nothing listed yet.
  const stages = useMemo(
    () =>
      [...STAGES].sort((a, b) => {
        const x = next[a.id]?.starts_at ?? '9999';
        const y = next[b.id]?.starts_at ?? '9999';
        return x < y ? -1 : x > y ? 1 : 0;
      }),
    [next],
  );
  const stage = STAGES.find((s) => s.id === filter);
  const test = stage?.test ?? ARTS_FILTERS.find((f) => f.id === filter)?.test;
  const shown = test ? all.filter(test) : all;
  const pick = (id: string) => {
    setFilter(id);
    track('events_filtered', { filter: `arts:${id}` });
  };

  return (
    <>
      <View style={{ gap: Spacing.two }}>
        {stages.map((s) => {
          const e = next[s.id];
          const active = filter === s.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => pick(active ? 'all' : s.id)}
              style={[
                styles.stage,
                { backgroundColor: active ? Brand.navy : theme.card, borderColor: active ? Brand.navy : theme.line },
              ]}>
              <T style={{ fontSize: 26 }}>{s.icon}</T>
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="cardTitle" color={active ? Brand.white : undefined}>
                  {s.name}
                </T>
                <T variant="small" color={active ? '#DFE6F2' : undefined}>
                  {s.blurb}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end', maxWidth: 170 }}>
                {e ? (
                  <>
                    <T style={[styles.next, { color: active ? Brand.orange : Brand.red }]}>{nextShowLabel(e.starts_at, now)}</T>
                    <T variant="small" color={active ? '#DFE6F2' : undefined} numberOfLines={1}>
                      {shortDay(e.starts_at)} · {timeLabel(e.starts_at, e.all_day, e.time_tbd)}
                    </T>
                  </>
                ) : (
                  <T variant="small" color={active ? '#DFE6F2' : undefined} style={{ textAlign: 'right' }}>
                    No shows on the calendar yet
                  </T>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ChipRow>
        <Chip label="All shows" active={filter === 'all'} onPress={() => pick('all')} />
        {ARTS_FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => pick(f.id)} />
        ))}
      </ChipRow>

      <LoadState
        loading={loading}
        error={error}
        empty={shows && !shown.length ? 'No shows on the calendar for this one yet.' : undefined}
      />
      <ShowsByDay days={byDay(shown)} />
    </>
  );
}

const styles = StyleSheet.create({
  stage: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  next: { fontFamily: Fonts.display, fontSize: 12.5, textAlign: 'right' },
});
