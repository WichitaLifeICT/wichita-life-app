import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AddToPlanButton } from '@/components/add-to-plan-button';
import { Button, Card, Chip, ChipRow, LoadState, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';
import { openDirections } from '@/lib/event-actions';
import { openLink } from '@/lib/links';
import {
  DAY_LONG,
  daysLabel,
  hoursLabel,
  isDeal,
  isHappeningNow,
  isLaterToday,
  kindOf,
  shareSpecial,
  type WeeklyKind,
  type WeeklySpecial,
  wichitaNow,
} from '@/lib/weekly';

type Filter = 'tonight' | 'happy_hour' | 'food_deal' | 'trivia' | 'nightlife' | 'week';

// Daily deals (happy hours and food deals) and Weekly (trivia, karaoke and other regulars) are
// two views of the same list on the Events tab.
const FILTERS: Record<'deals' | 'weekly', { id: Filter; label: string }[]> = {
  deals: [
    { id: 'tonight', label: 'Today' },
    { id: 'happy_hour', label: '🍻 Happy hours' },
    { id: 'food_deal', label: '🌮 Food deals' },
    { id: 'week', label: 'All week' },
  ],
  weekly: [
    { id: 'tonight', label: 'Today' },
    { id: 'trivia', label: '🧠 Trivia' },
    { id: 'nightlife', label: '🎤 Karaoke, open mic & more' },
    { id: 'week', label: 'All week' },
  ],
};

const NIGHTLIFE: WeeklyKind[] = ['karaoke', 'open_mic', 'live_music', 'game_night', 'other'];

/** Daily deals (happy hours, food deals) or the Weekly view (trivia nights and other regulars). */
export function WeeklyList({
  mode,
  specials,
  loading,
  error,
  now,
}: {
  mode: 'deals' | 'weekly';
  specials: WeeklySpecial[] | undefined;
  loading: boolean;
  error?: Error;
  now: Date;
}) {
  const track = useTrack();
  const [filter, setFilter] = useState<Filter>('tonight');
  const wNow = useMemo(() => wichitaNow(now), [now]);

  // Grouped by day, starting with today.
  const groups = useMemo(() => {
    const all = (specials ?? []).filter((s) => isDeal(s.kind) === (mode === 'deals'));
    if (filter === 'tonight') {
      const today = all.filter((s) => isLaterToday(s, wNow));
      return today.length ? [{ day: wNow.day, items: today }] : [];
    }
    const pick =
      filter === 'week'
        ? () => true
        : filter === 'nightlife'
          ? (s: WeeklySpecial) => NIGHTLIFE.includes(s.kind)
          : (s: WeeklySpecial) => s.kind === filter;
    return Array.from({ length: 7 }, (_, i) => (wNow.day + i) % 7)
      .map((day) => ({ day, items: all.filter((s) => pick(s) && s.days.includes(day)) }))
      .filter((g) => g.items.length);
  }, [specials, filter, wNow, mode]);

  const empty =
    specials && !groups.length
      ? filter === 'tonight'
        ? 'Nothing else on the list for today. Try All week.'
        : 'None of these on the list yet.'
      : undefined;

  return (
    <>
      <ChipRow>
        {FILTERS[mode].map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => {
              setFilter(f.id);
              track('events_filtered', { filter: `${mode}:${f.id}` });
            }}
          />
        ))}
      </ChipRow>

      <LoadState loading={loading} error={error} empty={empty} />

      {groups.map((g) => (
        <View key={g.day} style={{ gap: Spacing.two + 2 }}>
          <T variant="cardTitle" style={{ fontSize: 16 }}>
            {g.day === wNow.day ? `Today · ${DAY_LONG[g.day]}` : DAY_LONG[g.day]}
          </T>
          {g.items.map((s) => (
            <SpecialCard key={`${g.day}-${s.id}`} special={s} live={g.day === wNow.day && isHappeningNow(s, wNow)} />
          ))}
        </View>
      ))}

      <Card style={{ gap: Spacing.two }}>
        <T variant="cardTitle">
          {mode === 'deals' ? 'Know a happy hour or deal we’re missing?' : 'Know a trivia night or regular we’re missing?'}
        </T>
        <T variant="small">Tell us the place, the day and the deal, and we’ll add it.</T>
        <Button small tone="ghost" label="Suggest a special" onPress={() => router.push('/suggest-special')} />
      </Card>
    </>
  );
}

function SpecialCard({ special: s, live }: { special: WeeklySpecial; live: boolean }) {
  const track = useTrack();
  const [notice, setNotice] = useState<string>();
  const k = kindOf(s.kind);
  return (
    <Card style={{ gap: Spacing.one }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two }}>
        <T variant="small" style={{ flex: 1 }}>
          {k.icon} {k.label} · {daysLabel(s.days)} · {hoursLabel(s)}
        </T>
        {live ? <Tag label="On now" tone="green" /> : null}
      </View>
      <T variant="cardTitle">{s.title}</T>
      <T variant="small" color={Brand.navy}>
        {s.venue}
      </T>
      {s.details ? <T variant="small">{s.details}</T> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
        <AddToPlanButton kind="special" id={s.id} title={`${s.title} at ${s.venue}`} />
        <Button
          small
          tone="ghost"
          label="Share"
          onPress={async () => {
            track('weekly_opened', { special_id: s.id, kind: s.kind, action: 'share' });
            setNotice(await shareSpecial(s));
          }}
        />
        <Button
          small
          tone="ghost"
          label="Directions"
          onPress={() => {
            track('weekly_opened', { special_id: s.id, kind: s.kind, action: 'directions' });
            openDirections(s);
          }}
        />
        {s.url ? (
          <Button
            small
            tone="ghost"
            label="Details ↗"
            onPress={() => {
              track('weekly_opened', { special_id: s.id, kind: s.kind, action: 'link' });
              openLink(s.url!);
            }}
          />
        ) : null}
      </View>
      {notice ? <T variant="small">{notice}</T> : null}
    </Card>
  );
}
