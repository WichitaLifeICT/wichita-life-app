import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, ChipRow, Field, SectionHeader, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';
import { getActivities, type Activity } from '@/lib/activities';
import { searchEvents } from '@/lib/api';
import { errorMessage, shortDay, timeLabel } from '@/lib/format';
import { addToPlan, addDays, type NewItem } from '@/lib/plans';
import { cuisineLabel, searchPlaces, type Place } from '@/lib/places';
import type { EventItem } from '@/lib/types';
import { daysLabel, getWeeklySpecials, hoursLabel, kindOf, type WeeklySpecial } from '@/lib/weekly';

type Tab = 'events' | 'eat' | 'weekly' | 'do' | 'own';

const TABS: { id: Tab; label: string; search: string; hint: string }[] = [
  { id: 'events', label: '📅 Events', search: 'Search events', hint: 'Concert, Botanica, Orpheum…' },
  { id: 'eat', label: '🍽️ Food', search: 'Search restaurants', hint: 'Taco, Doo-Dah, coffee…' },
  { id: 'weekly', label: '🍻 Happy hours & trivia', search: 'Search happy hours, trivia, karaoke', hint: 'Trivia, Pumphouse…' },
  { id: 'do', label: '🎳 Things to do', search: 'Search things to do', hint: 'Bowling, zoo, mini golf…' },
  { id: 'own', label: '📍 Your own', search: '', hint: '' },
];

const weekday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

/**
 * On a plan: search and add events (during the plan's dates), places to eat, happy hours and
 * trivia, things to do, or your own spot.
 */
export function PlanAddThings({
  planId,
  startsOn,
  endsOn,
  onAdded,
}: {
  planId: string;
  startsOn: string | null;
  endsOn: string | null;
  onAdded: () => void;
}) {
  const track = useTrack();
  const [tab, setTab] = useState<Tab>('events');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [specials, setSpecials] = useState<WeeklySpecial[]>();
  const [activities, setActivities] = useState<Activity[]>();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  // Events and restaurants: search as you type (a short pause first). Only the newest search may
  // show its results, so a slow earlier one can't replace what matches the current text.
  const searchSeq = useRef(0);
  useEffect(() => {
    if (tab !== 'eat' && tab !== 'events') return;
    const t = setTimeout(() => {
      const seq = ++searchSeq.current;
      const fail = (e: unknown) => seq === searchSeq.current && setError(errorMessage(e));
      if (tab === 'eat') searchPlaces(query).then((r) => seq === searchSeq.current && setPlaces(r), fail);
      else searchEvents(query, startsOn, endsOn).then((r) => seq === searchSeq.current && setEvents(r), fail);
    }, 250);
    return () => clearTimeout(t);
  }, [query, tab, startsOn, endsOn]);

  useEffect(() => {
    if (tab === 'do' && !activities) getActivities().then(setActivities, (e) => setError(errorMessage(e)));
    if (tab === 'weekly' && !specials) getWeeklySpecials().then(setSpecials, (e) => setError(errorMessage(e)));
  }, [tab, activities, specials]);

  const q = query.trim().toLowerCase();
  const shownActivities = useMemo(
    () => (activities ?? []).filter((a) => !q || a.name.toLowerCase().includes(q) || a.blurb.toLowerCase().includes(q)).slice(0, 8),
    [activities, q],
  );
  // Specials on the plan's days (when it has dates), matching the search.
  const shownSpecials = useMemo(() => {
    const days = new Set<number>();
    if (startsOn) for (let k = startsOn, i = 0; k <= (endsOn ?? startsOn) && i < 7; k = addDays(k, 1), i++) days.add(weekday(k));
    return (specials ?? [])
      .filter((s) => !days.size || s.days.some((d) => days.has(d)))
      .filter((s) => !q || `${s.title} ${s.venue} ${kindOf(s.kind).label}`.toLowerCase().includes(q))
      .slice(0, 10);
  }, [specials, q, startsOn, endsOn]);

  // Ignore a second tap while the first add is still saving (it would add the item twice).
  const inFlight = useRef(new Set<string>());
  const add = async (key: string, item: NewItem) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setError(undefined);
    try {
      await addToPlan(planId, item);
      track('plan_item_added', { kind: item.kind, new_plan: false });
      setAdded((a) => [...a, key]);
      onAdded();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current.delete(key);
    }
  };

  const row = (key: string, title: string, sub: string | null, item: NewItem) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one }}>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: Fonts.display }}>{title}</T>
        {sub ? <T variant="small">{sub}</T> : null}
      </View>
      {added.includes(key) ? (
        <T variant="small" color={Brand.green} style={{ fontFamily: Fonts.display }}>
          ✓ Added
        </T>
      ) : (
        <Button small tone="ghost" label="Add" onPress={() => add(key, item)} />
      )}
    </View>
  );

  return (
    <Card style={{ gap: Spacing.two }}>
      <SectionHeader title="Add to this plan" />
      <ChipRow>
        {TABS.map((t) => (
          <Chip key={t.id} label={t.label} active={tab === t.id} onPress={() => setTab(t.id)} />
        ))}
      </ChipRow>

      {tab === 'own' ? (
        <>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Sam’s house, the lake, a new taco truck…" maxLength={120} />
          <Field label="Address (optional)" value={address} onChangeText={setAddress} placeholder="123 N Main" maxLength={200} />
          <Button
            small
            tone="navy"
            label="Add to plan"
            disabled={!name.trim()}
            onPress={async () => {
              await add(`own:${name}`, { kind: 'spot', note: name, address: address || null });
              setName('');
              setAddress('');
            }}
          />
        </>
      ) : (
        <>
          <Field
            label={TABS.find((t) => t.id === tab)!.search}
            value={query}
            onChangeText={setQuery}
            placeholder={TABS.find((t) => t.id === tab)!.hint}
            autoCorrect={false}
          />
          {tab === 'events'
            ? events.map((e) =>
                row(`event:${e.id}`, e.title, [`${shortDay(e.starts_at)} ${timeLabel(e.starts_at, e.all_day, e.time_tbd)}`, e.venue].filter(Boolean).join(' · '), {
                  kind: 'event',
                  ref_id: e.id,
                }),
              )
            : tab === 'eat'
              ? places.map((p) => row(`place:${p.id}`, p.name, [cuisineLabel(p), p.address].filter(Boolean).join(' · '), { kind: 'place', ref_id: p.id }))
              : tab === 'weekly'
                ? shownSpecials.map((s) =>
                    row(`special:${s.id}`, `${kindOf(s.kind).icon} ${s.title}`, `${s.venue} · ${daysLabel(s.days)} · ${hoursLabel(s)}`, {
                      kind: 'special',
                      ref_id: s.id,
                    }),
                  )
                : shownActivities.map((a) => row(`activity:${a.id}`, a.name, a.blurb || a.address || null, { kind: 'activity', activity_id: a.id }))}
          {tab === 'events' && !events.length ? (
            <T variant="small">
              {q.length >= 2
                ? 'No upcoming events match that.'
                : startsOn
                  ? 'Nothing listed during this plan yet. Try a search.'
                  : 'Type to search upcoming events.'}
            </T>
          ) : null}
          {tab === 'events' && !q && startsOn && events.length ? (
            <T variant="small">Showing some from each day of this plan. Type to search everything coming up.</T>
          ) : null}
          {tab === 'eat' && q.length >= 2 && !places.length ? <T variant="small">Not on our list yet. Add it under “Your own”.</T> : null}
          {tab === 'eat' && q.length < 2 ? <T variant="small">Type a name to search local restaurants.</T> : null}
          {tab === 'weekly' && startsOn && !q ? <T variant="small">Showing ones that happen during this plan.</T> : null}
        </>
      )}
      {error ? <T color={Brand.redText}>{error}</T> : null}
    </Card>
  );
}
