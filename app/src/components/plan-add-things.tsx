import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, ChipRow, Field, SectionHeader, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';
import { getActivities, type Activity } from '@/lib/activities';
import { errorMessage } from '@/lib/format';
import { addToPlan, type NewItem } from '@/lib/plans';
import { cuisineLabel, searchPlaces, type Place } from '@/lib/places';

type Tab = 'eat' | 'do' | 'own';

/** On a plan: add a place to eat (search our list), something to do, or your own spot. */
export function PlanAddThings({ planId, onAdded }: { planId: string; onAdded: () => void }) {
  const track = useTrack();
  const [tab, setTab] = useState<Tab>('eat');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [activities, setActivities] = useState<Activity[]>();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  // Restaurants: search as you type (a short pause first).
  useEffect(() => {
    if (tab !== 'eat') return;
    const t = setTimeout(() => searchPlaces(query).then(setPlaces, (e) => setError(errorMessage(e))), 250);
    return () => clearTimeout(t);
  }, [query, tab]);

  useEffect(() => {
    if (tab === 'do' && !activities) getActivities().then(setActivities, (e) => setError(errorMessage(e)));
  }, [tab, activities]);

  const shownActivities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (activities ?? []).filter((a) => !q || a.name.toLowerCase().includes(q) || a.blurb.toLowerCase().includes(q)).slice(0, 8);
  }, [activities, query]);

  const add = async (key: string, item: NewItem) => {
    setError(undefined);
    try {
      await addToPlan(planId, item);
      track('plan_item_added', { kind: item.kind, new_plan: false });
      setAdded((a) => [...a, key]);
      onAdded();
    } catch (e) {
      setError(errorMessage(e));
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
      <SectionHeader title="Add a place or activity" />
      <ChipRow>
        <Chip label="🍽️ Places to eat" active={tab === 'eat'} onPress={() => setTab('eat')} />
        <Chip label="🎳 Things to do" active={tab === 'do'} onPress={() => setTab('do')} />
        <Chip label="📍 Your own spot" active={tab === 'own'} onPress={() => setTab('own')} />
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
            label={tab === 'eat' ? 'Search restaurants' : 'Search things to do'}
            value={query}
            onChangeText={setQuery}
            placeholder={tab === 'eat' ? 'Taco, Doo-Dah, coffee…' : 'Bowling, zoo, mini golf…'}
            autoCorrect={false}
          />
          {tab === 'eat'
            ? places.map((p) => row(`place:${p.id}`, p.name, [cuisineLabel(p), p.address].filter(Boolean).join(' · '), { kind: 'place', ref_id: p.id }))
            : shownActivities.map((a) => row(`activity:${a.id}`, a.name, a.blurb || a.address || null, { kind: 'activity', activity_id: a.id }))}
          {tab === 'eat' && query.trim().length >= 2 && !places.length ? (
            <T variant="small">Not on our list yet. Add it under “Your own spot”.</T>
          ) : null}
          {tab === 'eat' && query.trim().length < 2 ? <T variant="small">Type a name to search local restaurants.</T> : null}
        </>
      )}
      {error ? <T color={Brand.redText}>{error}</T> : null}
    </Card>
  );
}
