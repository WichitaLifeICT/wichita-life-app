import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeLabel } from '@/lib/format';
import { itinerary, type PlanDetail, type PlanItem } from '@/lib/plans';
import { clock, kindOf, type WeeklyKind } from '@/lib/weekly';

const ICON: Record<PlanItem['kind'], string> = { event: '📅', special: '🔁', place: '🍽️', meetup: '👋', note: '📝' };

function describe(item: PlanItem, minutes: number | null) {
  const r = item.ref;
  const time = minutes === null ? null : clock(`${Math.floor(minutes / 60)}:${minutes % 60}`);
  if (item.kind === 'note') return { icon: ICON.note, title: item.note ?? '', sub: null, time };
  if (!r) return { icon: ICON[item.kind], title: 'No longer listed', sub: 'This was removed from Wichita Life.', time: null };
  switch (item.kind) {
    case 'event':
      return {
        icon: ICON.event,
        title: r.title,
        sub: r.venue ?? null,
        time: r.starts_at ? timeLabel(r.starts_at, r.all_day, r.time_tbd) : time,
      };
    case 'meetup':
      return { icon: ICON.meetup, title: r.title, sub: `Wichita Life meetup · ${r.area}`, time };
    case 'special':
      return {
        icon: kindOf((r.kind ?? 'other') as WeeklyKind).icon,
        title: r.title,
        sub: `${r.venue}${r.ends ? ` · until ${clock(r.ends)}` : ''}`,
        time,
      };
    case 'place':
      return { icon: ICON.place, title: r.title, sub: r.address ?? null, time };
  }
}

function open(item: PlanItem) {
  if (!item.ref || !item.ref_id) return;
  if (item.kind === 'event') router.push({ pathname: '/event/[id]', params: { id: item.ref_id } });
  else if (item.kind === 'special') router.push({ pathname: '/special/[id]', params: { id: item.ref_id } });
  else if (item.kind === 'meetup') router.push('/meet');
}

/** A plan as an itinerary: a card per day, in time order. `action` adds a control to each row. */
export function PlanView({
  plan,
  action,
}: {
  plan: PlanDetail;
  action?: (item: PlanItem, day: string | null) => React.ReactNode;
}) {
  const theme = useTheme();
  const days = itinerary(plan);
  if (!days.length) return null;
  return (
    <View style={{ gap: Spacing.three }}>
      {days.map((d) => (
        <View key={d.day ?? 'anytime'} style={{ gap: Spacing.two }}>
          <T variant="cardTitle" style={{ fontSize: 16 }}>
            {d.title}
          </T>
          <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
            {d.rows.map(({ item, minutes }, i) => {
              const x = describe(item, minutes);
              const tappable = !!item.ref && (item.kind === 'event' || item.kind === 'special' || item.kind === 'meetup');
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.two,
                    paddingVertical: Spacing.two,
                    borderTopWidth: i ? 1 : 0,
                    borderColor: theme.line,
                  }}>
                  <T variant="small" style={{ width: 58, fontFamily: Fonts.display, color: Brand.redText }}>
                    {x.time ?? ''}
                  </T>
                  <Pressable style={{ flex: 1 }} disabled={!tappable} onPress={() => open(item)}>
                    <T style={{ fontFamily: Fonts.display }} color={item.ref || item.kind === 'note' ? theme.heading : theme.textSecondary}>
                      {x.icon} {x.title}
                      {tappable ? ' ›' : ''}
                    </T>
                    {x.sub ? <T variant="small">{x.sub}</T> : null}
                  </Pressable>
                  {action ? action(item, d.day) : null}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );
}
