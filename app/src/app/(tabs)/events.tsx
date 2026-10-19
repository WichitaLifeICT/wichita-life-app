import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EventRow } from '@/components/event-row';
import { AppHeader, Chip, ChipRow, LoadState, PressableCard, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { getUpcomingEvents } from '@/lib/api';
import { dayHeading, dayKey, isThisWeekend } from '@/lib/format';
import { openLink } from '@/lib/links';
import type { EventItem } from '@/lib/types';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'free', label: 'Free' },
  { id: 'family', label: 'Family' },
  { id: 'food', label: 'Food & drink' },
  { id: 'music', label: 'Music' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

function matches(e: EventItem, f: FilterId) {
  if (f === 'all') return true;
  if (f === 'weekend') return isThisWeekend(e.starts_at);
  return e.tags.includes(f);
}

export default function EventsScreen() {
  const track = useTrack();
  const [filter, setFilter] = useState<FilterId>('all');
  const q = useQuery(() => getUpcomingEvents(150));

  const days = useMemo(() => {
    const groups = new Map<string, EventItem[]>();
    for (const e of q.data ?? []) {
      if (!matches(e, filter)) continue;
      const k = dayKey(e.starts_at);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.values()];
  }, [q.data, filter]);

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Events" />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              active={filter === f.id}
              onPress={() => {
                setFilter(f.id);
                track('events_filtered', { filter: f.id });
              }}
            />
          ))}
        </ChipRow>

        <LoadState
          loading={q.loading}
          error={q.error}
          empty={q.data && !days.length ? 'Nothing matches yet. Try another filter.' : undefined}
        />

        {days.map((events) => (
          <View key={events[0].id} style={{ gap: Spacing.two + 2 }}>
            <T variant="cardTitle" style={{ fontSize: 16 }}>
              {dayHeading(events[0].starts_at)}
            </T>
            {events.map((e) => (
              <EventRow key={e.id} event={e} onOpen={() => track('event_viewed', { event_id: e.id, from: 'events' })} />
            ))}
          </View>
        ))}

        <PressableCard accessibilityRole="link" onPress={() => openLink('https://events.wichitalifeict.com')}>
          <T variant="small">Powered by events.wichitalifeict.com</T>
          <T variant="cardTitle">See the full calendar or submit an event ↗</T>
        </PressableCard>
      </Screen>
    </View>
  );
}
